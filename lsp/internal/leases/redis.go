package leases

// --- IMPORTS ---
import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// --- GLOBALS ---

// acquireScript drops the leases of dead instances, then takes one if any
// is left: KEYS[1] the player's set; now, deadline, max, holder, ttl ms
var acquireScript = redis.NewScript(`
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`)

// how long a lease lasts without renewal: a dead instance frees its own
const defaultTTL = 30 * time.Second

// how long giving a lease back may take on its own
const releaseTimeout = 2 * time.Second

// --- CODE ---

// Redis keeps each player's leases in a sorted set, scored by deadline.
type Redis struct {
	client *redis.Client
	prefix string
	max    int
	ttl    time.Duration
}

// NewRedis builds the leases, at most max per player.
func NewRedis(client *redis.Client, prefix string, max int) *Redis {
	return &Redis{client: client, prefix: prefix, max: max, ttl: defaultTTL}
}

// Acquire takes a lease, renewed in the background until released.
func (r *Redis) Acquire(ctx context.Context, player string) (Lease, error) {

	key := r.prefix + "lsp:player:" + player
	holder := newHolder()
	now := time.Now()

	taken, err := acquireScript.Run(ctx, r.client, []string{key},
		now.UnixMilli(),
		now.Add(r.ttl).UnixMilli(),
		r.max,
		holder,
		strconv.FormatInt(r.ttl.Milliseconds(), 10),
	).Int()

	if err != nil {
		return nil, err
	}

	if taken == 0 {
		return nil, ErrFull
	}

	lease := &redisLease{
		leases: r,
		key:    key,
		holder: holder,
		done:   make(chan struct{}),
	}

	go lease.renew()

	return lease, nil
}

// redisLease is a held lease and its renewal.
type redisLease struct {
	leases *Redis
	key    string
	holder string
	done   chan struct{}
	once   sync.Once
}

// renew pushes the deadline forward until the lease is released.
func (l *redisLease) renew() {

	ticker := time.NewTicker(l.leases.ttl / 3)
	defer ticker.Stop()

	for {
		select {
		case <-l.done:
			return

		// a failed renewal is retried on the next tick, before the ttl
		case <-ticker.C:
			deadline := time.Now().Add(l.leases.ttl).UnixMilli()
			pipe := l.leases.client.TxPipeline()

			pipe.ZAddXX(context.Background(), l.key, redis.Z{
				Score:  float64(deadline),
				Member: l.holder,
			})
			pipe.PExpire(context.Background(), l.key, l.leases.ttl)

			_, _ = pipe.Exec(context.Background())
		}
	}
}

// Release stops the renewal and gives the lease back.
func (l *redisLease) Release() {

	l.once.Do(func() {
		close(l.done)

		ctx, cancel := context.WithTimeout(context.Background(),
			releaseTimeout)
		defer cancel()

		// left behind on failure: it expires with its ttl
		l.leases.client.ZRem(ctx, l.key, l.holder)
	})
}

// newHolder makes a lease's id.
func newHolder() string {

	buffer := make([]byte, 8)
	_, _ = rand.Read(buffer)

	return hex.EncodeToString(buffer)
}
