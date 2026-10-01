package server

// --- IMPORTS ---
import (
	"errors"
	"sync"
)

// --- GLOBALS ---

// errServerFull is returned when every slot is taken.
var errServerFull = errors.New("too many sessions")

// --- CODE ---

// limiter caps this instance's sessions; the slot picks the uid. The cap
// per player is shared by every instance, see the leases package.
type limiter struct {
	mu sync.Mutex

	// slots[i] is true while a session holds slot i
	slots []bool
	used  int
}

// newLimiter builds a limiter with the given cap.
func newLimiter(maxTotal int) *limiter {
	return &limiter{slots: make([]bool, maxTotal)}
}

// acquire takes a free slot, returning its number.
func (l *limiter) acquire() (int, error) {

	l.mu.Lock()
	defer l.mu.Unlock()

	for slot, taken := range l.slots {
		if !taken {
			l.slots[slot] = true
			l.used++

			return slot, nil
		}
	}

	return 0, errServerFull
}

// release gives a slot back.
func (l *limiter) release(slot int) {

	l.mu.Lock()
	defer l.mu.Unlock()

	l.slots[slot] = false
	l.used--
}

// active is how many sessions are running.
func (l *limiter) active() int {

	l.mu.Lock()
	defer l.mu.Unlock()

	return l.used
}
