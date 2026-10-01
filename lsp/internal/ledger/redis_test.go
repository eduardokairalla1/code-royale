package ledger

// --- IMPORTS ---
import (
	"errors"
	"testing"
	"time"

	"code-royale/lsp/internal/redistest"
)

// --- CODE ---

// TestRedisSpendsTicketsOnce checks a ticket opens one session only, on
// any instance.
func TestRedisSpendsTicketsOnce(t *testing.T) {

	client, prefix := redistest.Client(t)
	one := NewRedis(client, prefix)
	two := NewRedis(client, prefix)
	expires := time.Now().Add(time.Minute)

	if err := one.Spend(t.Context(), "t1", expires); err != nil {
		t.Fatalf("first use refused: %v", err)
	}

	err := two.Spend(t.Context(), "t1", expires)

	if !errors.Is(err, ErrSpent) {
		t.Fatalf("second use: want ErrSpent, got %v", err)
	}

	if err := two.Spend(t.Context(), "t2", expires); err != nil {
		t.Fatalf("another ticket refused: %v", err)
	}
}

// TestRedisForgetsExpiredTickets checks spent tickets do not pile up.
func TestRedisForgetsExpiredTickets(t *testing.T) {

	client, prefix := redistest.Client(t)
	ledger := NewRedis(client, prefix)

	_ = ledger.Spend(t.Context(), "t1", time.Now().Add(time.Second))

	ttl := client.PTTL(t.Context(), prefix+"lsp:ticket:t1").Val()

	if ttl <= 0 || ttl > time.Second {
		t.Fatalf("spent ticket kept for %v", ttl)
	}
}
