package server

// --- IMPORTS ---
import (
	"errors"
	"testing"
)

// --- CODE ---

// TestLimiterCapsSessions checks the total cap and the release.
func TestLimiterCapsSessions(t *testing.T) {

	limits := newLimiter(2)

	first, err1 := limits.acquire()
	second, err2 := limits.acquire()

	if err1 != nil || err2 != nil || first == second {
		t.Fatal("slots under the cap refused or shared")
	}

	if _, err := limits.acquire(); !errors.Is(err, errServerFull) {
		t.Fatalf("past the cap: got %v", err)
	}

	limits.release(first)

	slot, err := limits.acquire()

	if err != nil || slot != first || limits.active() != 2 {
		t.Fatal("released slot not reused")
	}
}
