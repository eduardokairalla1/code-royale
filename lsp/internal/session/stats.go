package session

// --- IMPORTS ---
import (
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// distinct method names kept per list: a crafted client could send endless
const maxMethods = 10

// --- CODE ---

// Stats is what a session saw, for its log event. Read it after Run.
type Stats struct {

	// until the client got its ready message; zero if it never did
	SetupDuration time.Duration

	// the setup step running when it failed: workspace, server or ready
	SetupStep string

	// until the server's first message reached the client: when it is useful
	FirstReply time.Duration

	// from the session's end to the last of its cleanup
	StopDuration time.Duration

	// client messages, messages to it, dropped, server requests answered
	MessagesIn     atomic.Int64
	MessagesOut    atomic.Int64
	MessagesDrop   atomic.Int64
	ServerRequests atomic.Int64

	// the close code sent; zero when the socket was just dropped
	CloseCode websocket.StatusCode

	// how the server ended when it died on its own, e.g. "exit status 1"
	ServerExit string

	// processes of the session's user still alive after its server stopped
	LeftoverProcesses int

	// why the session folder could not be removed, if it could not
	CleanupError string

	// both relays write these at once: guarded by mu
	mu             sync.Mutex
	drops          map[dropReason]int64
	droppedMethods methodList
	requestMethods methodList

	// when the session began, and when it began to stop
	started  time.Time
	stopping time.Time
}

// Ready tells whether the session got as far as its ready message.
func (s *Stats) Ready() bool {
	return s.SetupDuration > 0
}

// Suspicious tells whether the client tried to reach files outside its own.
func (s *Stats) Suspicious() bool {

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.drops[dropDocument] > 0
}

// Drops returns how many messages were dropped, by why.
func (s *Stats) Drops() map[string]int64 {

	s.mu.Lock()
	defer s.mu.Unlock()

	drops := make(map[string]int64, len(s.drops))

	for reason, count := range s.drops {
		drops[string(reason)] = count
	}

	return drops
}

// DroppedMethods returns the distinct methods the filter dropped.
func (s *Stats) DroppedMethods() []string {

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.droppedMethods.items()
}

// RequestMethods returns the distinct requests the server sent the client.
func (s *Stats) RequestMethods() []string {

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.requestMethods.items()
}

// replied records the server's first message reaching the client.
func (s *Stats) replied() {

	// only the client relay writes it, and Run's caller reads it after
	if s.FirstReply == 0 {
		s.FirstReply = time.Since(s.started)
	}
}

// dropped counts a message the filter dropped, why, and its method.
func (s *Stats) dropped(reason dropReason, method string) {

	s.MessagesDrop.Add(1)

	s.mu.Lock()
	defer s.mu.Unlock()

	// created on the first drop: most sessions never drop anything
	if s.drops == nil {
		s.drops = map[dropReason]int64{}
	}

	s.drops[reason]++
	s.droppedMethods.add(method)
}

// serverRequested counts a request of the server the service answered.
func (s *Stats) serverRequested(method string) {

	s.ServerRequests.Add(1)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.requestMethods.add(method)
}

// methodList keeps distinct method names, up to maxMethods.
type methodList []string

// add keeps a new name; empty ones, repeats and those past the cap are not.
func (l *methodList) add(method string) {

	if method == "" || len(*l) >= maxMethods || slices.Contains(*l, method) {
		return
	}

	*l = append(*l, method)
}

// items returns a copy, safe to read once the lock is released.
func (l methodList) items() []string {
	return slices.Clone(l)
}
