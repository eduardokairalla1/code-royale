package server

// --- IMPORTS ---
import (
	"errors"
	"sync"
)

// --- GLOBALS ---

// errServerFull is returned when every slot is taken.
var errServerFull = errors.New("too many sessions")

// errPlayerFull is returned when the player already runs their share.
var errPlayerFull = errors.New("too many sessions for this player")

// --- CODE ---

// limiter caps sessions in total and per player; the slot picks the uid.
type limiter struct {
	mu sync.Mutex

	// slots[i] is true while a session holds slot i
	slots []bool
	used  int

	// sessions per player id, and the most one player may hold
	players   map[string]int
	maxPlayer int
}

// newLimiter builds a limiter with the given caps.
func newLimiter(maxTotal, maxPerPlayer int) *limiter {

	return &limiter{
		slots:     make([]bool, maxTotal),
		players:   map[string]int{},
		maxPlayer: maxPerPlayer,
	}
}

// acquire takes a free slot for the player, returning its number.
func (l *limiter) acquire(player string) (int, error) {

	l.mu.Lock()
	defer l.mu.Unlock()

	if l.players[player] >= l.maxPlayer {
		return 0, errPlayerFull
	}

	for slot, taken := range l.slots {
		if !taken {
			l.slots[slot] = true
			l.used++
			l.players[player]++

			return slot, nil
		}
	}

	return 0, errServerFull
}

// release gives the player's slot back.
func (l *limiter) release(slot int, player string) {

	l.mu.Lock()
	defer l.mu.Unlock()

	l.slots[slot] = false
	l.used--

	// forget players with nothing left, so the map does not grow
	if l.players[player]--; l.players[player] <= 0 {
		delete(l.players, player)
	}
}

// active is how many sessions are running.
func (l *limiter) active() int {

	l.mu.Lock()
	defer l.mu.Unlock()

	return l.used
}
