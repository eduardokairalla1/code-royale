package recovery

// --- IMPORTS ---
import (
	"errors"
	"strings"
	"testing"
)

// --- CODE ---

// TestNewKeepsValueAndStack checks a panic keeps what and where.
func TestNewKeepsValueAndStack(t *testing.T) {

	err := New("boom")

	if !errors.Is(err, ErrPanic) || err.Error() != "panic: boom" {
		t.Fatalf("got %v", err)
	}

	if !strings.Contains(err.Stack, "TestNewKeepsValueAndStack") {
		t.Fatalf("stack misses the caller:\n%s", err.Stack)
	}
}
