package server

// --- IMPORTS ---
import (
	"errors"
	"testing"
)

// --- CODE ---

// TestLimiterCapsSessions checks the total cap and the release.
func TestLimiterCapsSessions(t *testing.T) {

	limits := newLimiter(2, 5)

	first, err1 := limits.acquire("a")
	second, err2 := limits.acquire("b")

	if err1 != nil || err2 != nil || first == second {
		t.Fatal("slots under the cap refused or shared")
	}

	if _, err := limits.acquire("c"); !errors.Is(err, errServerFull) {
		t.Fatalf("past the cap: got %v", err)
	}

	limits.release(first, "a")

	slot, err := limits.acquire("c")

	if err != nil || slot != first || limits.active() != 2 {
		t.Fatal("released slot not reused")
	}
}

// TestLimiterCapsPlayers checks one player cannot take every slot.
func TestLimiterCapsPlayers(t *testing.T) {

	limits := newLimiter(10, 2)

	slot, _ := limits.acquire("a")
	_, _ = limits.acquire("a")

	if _, err := limits.acquire("a"); !errors.Is(err, errPlayerFull) {
		t.Fatalf("past the player cap: got %v", err)
	}

	if _, err := limits.acquire("b"); err != nil {
		t.Fatal("another player refused")
	}

	limits.release(slot, "a")

	if _, err := limits.acquire("a"); err != nil {
		t.Fatal("released player slot not reusable")
	}
}
