package ledger

// --- IMPORTS ---
import (
	"context"
	"sync"
	"time"
)

// --- CODE ---

// Memory is a Ledger in this process's memory: for a single instance.
type Memory struct {
	mu    sync.Mutex
	spent map[string]time.Time
	now   func() time.Time
}

// NewMemory builds an empty in-memory ledger.
func NewMemory() *Memory {
	return &Memory{spent: map[string]time.Time{}, now: time.Now}
}

// Spend marks the ticket as used, failing if it already was.
func (m *Memory) Spend(_ context.Context, id string, expires time.Time) error {

	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.now()

	// expired ones are refused anyway: forget them, so the map stays small
	for spentID, until := range m.spent {
		if now.After(until) {
			delete(m.spent, spentID)
		}
	}

	if _, used := m.spent[id]; used {
		return ErrSpent
	}

	m.spent[id] = expires

	return nil
}
