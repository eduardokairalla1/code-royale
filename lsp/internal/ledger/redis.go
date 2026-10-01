package ledger

// --- IMPORTS ---
import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// --- CODE ---

// Redis is a Ledger shared by every instance of the service.
type Redis struct {
	client *redis.Client
	prefix string
}

// NewRedis builds a ledger on the given client.
func NewRedis(client *redis.Client, prefix string) *Redis {
	return &Redis{client: client, prefix: prefix}
}

// Spend marks the ticket as used, failing if it already was.
func (r *Redis) Spend(ctx context.Context, id string, expires time.Time) error {

	// kept until the ticket expires: refused anyway after that
	set, err := r.client.SetArgs(ctx, r.prefix+"lsp:ticket:"+id, 1,
		redis.SetArgs{Mode: "NX", ExpireAt: expires}).Result()

	// a nil reply means the key was already there
	if err == redis.Nil || (err == nil && set != "OK") {
		return ErrSpent
	}

	return err
}
