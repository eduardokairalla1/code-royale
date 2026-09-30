package ledger

// --- IMPORTS ---
import (
	"context"
	"errors"
	"testing"
	"time"
)

// --- CODE ---

// TestMemorySpendsTicketsOnce checks a ticket opens one session only.
func TestMemorySpendsTicketsOnce(t *testing.T) {

	ledger := NewMemory()
	ledger.now = func() time.Time { return time.Unix(1000, 0) }
	ctx := context.Background()

	if err := ledger.Spend(ctx, "t1", time.Unix(1060, 0)); err != nil {
		t.Fatalf("first use refused: %v", err)
	}

	err := ledger.Spend(ctx, "t1", time.Unix(1060, 0))

	if !errors.Is(err, ErrSpent) {
		t.Fatalf("second use: want ErrSpent, got %v", err)
	}
}

// TestMemoryForgetsExpiredTickets checks the map does not grow forever.
func TestMemoryForgetsExpiredTickets(t *testing.T) {

	ledger := NewMemory()
	ledger.now = func() time.Time { return time.Unix(1000, 0) }
	ctx := context.Background()

	_ = ledger.Spend(ctx, "t1", time.Unix(1060, 0))

	ledger.now = func() time.Time { return time.Unix(1100, 0) }
	_ = ledger.Spend(ctx, "t2", time.Unix(2000, 0))

	if _, kept := ledger.spent["t1"]; kept {
		t.Fatal("expired ticket kept")
	}
}
