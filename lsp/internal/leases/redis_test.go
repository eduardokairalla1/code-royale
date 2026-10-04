package leases

// --- IMPORTS ---
import (
	"errors"
	"testing"
	"time"

	"code-royale/lsp/internal/redistest"
)

// --- CODE ---

// TestRedisCapsEachPlayer checks the cap holds across instances.
func TestRedisCapsEachPlayer(t *testing.T) {

	client, prefix := redistest.Client(t)
	one := NewRedis(client, prefix, 2)
	two := NewRedis(client, prefix, 2)

	first, err1 := one.Acquire(t.Context(), "p1")
	_, err2 := two.Acquire(t.Context(), "p1")

	if err1 != nil || err2 != nil {
		t.Fatalf("leases under the cap refused: %v, %v", err1, err2)
	}

	if _, err := one.Acquire(t.Context(), "p1"); !errors.Is(err, ErrFull) {
		t.Fatalf("past the cap: got %v", err)
	}

	if _, err := two.Acquire(t.Context(), "p2"); err != nil {
		t.Fatalf("another player refused: %v", err)
	}

	first.Release()

	if _, err := two.Acquire(t.Context(), "p1"); err != nil {
		t.Fatalf("released lease not reusable: %v", err)
	}
}

// TestRedisRenewsAndExpires checks a held lease outlives its ttl, and one
// nobody renews, as when its instance dies, frees itself.
func TestRedisRenewsAndExpires(t *testing.T) {

	client, prefix := redistest.Client(t)
	leases := NewRedis(client, prefix, 1)
	leases.ttl = 150 * time.Millisecond

	held, err := leases.Acquire(t.Context(), "p1")

	if err != nil {
		t.Fatal(err)
	}

	time.Sleep(400 * time.Millisecond)

	if _, err := leases.Acquire(t.Context(), "p1"); !errors.Is(err, ErrFull) {
		t.Fatalf("renewed lease lost: got %v", err)
	}

	// a dead instance: the renewal stops, the lease stays in redis
	close(held.(*redisLease).done)
	time.Sleep(300 * time.Millisecond)

	if _, err := leases.Acquire(t.Context(), "p1"); err != nil {
		t.Fatalf("expired lease kept: %v", err)
	}
}
