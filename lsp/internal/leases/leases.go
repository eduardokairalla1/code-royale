// Package leases caps the sessions of each player across every instance.
package leases

// --- IMPORTS ---
import (
	"context"
	"errors"
)

// --- GLOBALS ---

// ErrFull is returned when the player already holds every lease allowed.
var ErrFull = errors.New("too many sessions for this player")

// --- CODE ---

// Leases hands out the sessions a player may run.
type Leases interface {

	// Acquire takes a lease for the player, or returns ErrFull.
	Acquire(ctx context.Context, player string) (Lease, error)
}

// Lease is one session's hold, kept alive until released.
type Lease interface {

	// Release gives the lease back.
	Release()
}
