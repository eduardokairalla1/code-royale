// Package ledger remembers spent tickets, so each opens one session only.
package ledger

// --- IMPORTS ---
import (
	"context"
	"errors"
	"time"
)

// --- GLOBALS ---

// ErrSpent is returned for a ticket that already opened a session.
var ErrSpent = errors.New("ticket already used")

// --- CODE ---

// Ledger records spent tickets until they expire.
type Ledger interface {

	// Spend marks the ticket as used, or returns ErrSpent if it already was.
	Spend(ctx context.Context, id string, expires time.Time) error
}
