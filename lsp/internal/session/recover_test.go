package session

// --- IMPORTS ---
import (
	"context"
	"errors"
	"testing"

	"code-royale/lsp/internal/recovery"
)

// --- CODE ---

// TestRecoveredEndsTheSessionOnly cancels the session, not the process.
func TestRecoveredEndsTheSessionOnly(t *testing.T) {

	ctx, cancel := context.WithCancelCause(t.Context())
	done := make(chan struct{})

	go func() {
		defer close(done)
		defer recovered(cancel)
		panic("boom")
	}()

	<-done

	if cause := context.Cause(ctx); !errors.Is(cause, recovery.ErrPanic) {
		t.Fatalf("want a panic cause, got %v", cause)
	}
}
