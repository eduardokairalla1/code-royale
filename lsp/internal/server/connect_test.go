package server

// --- IMPORTS ---
import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"code-royale/lsp/internal/config"
	"code-royale/lsp/internal/logging"
	"code-royale/lsp/internal/session"
	"code-royale/lsp/internal/ticket"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

const secret = "0123456789abcdef0123456789abcdef"

// --- CODE ---

// logs collects the service's log lines, safe across goroutines.
type logs struct {
	mu     sync.Mutex
	buffer bytes.Buffer
}

// Write keeps a log line.
func (l *logs) Write(line []byte) (int, error) {

	l.mu.Lock()
	defer l.mu.Unlock()

	return l.buffer.Write(line)
}

// event waits for the session's summary line and returns its fields.
func (l *logs) event(t *testing.T) map[string]any {

	t.Helper()

	fields := l.find(string(logging.Session), 3*time.Second)

	if fields == nil {
		t.Fatal("no session event logged")
	}

	return fields
}

// find waits up to wait for a line with the given message.
func (l *logs) find(message string, wait time.Duration) map[string]any {

	deadline := time.Now().Add(wait)

	// looks at least once; the summary lands just after the socket closes
	for {
		l.mu.Lock()
		lines := strings.Split(strings.TrimSpace(l.buffer.String()), "\n")
		l.mu.Unlock()

		for _, line := range lines {
			var fields map[string]any

			if json.Unmarshal([]byte(line), &fields) == nil &&
				fields["msg"] == message {
				return fields
			}
		}

		if !time.Now().Before(deadline) {
			return nil
		}

		time.Sleep(20 * time.Millisecond)
	}
}

// dial starts the service and connects an editor with a raw ticket.
func dial(t *testing.T, raw string) (*websocket.Conn, *logs) {

	cfg := config.Config{
		Secret:               secret,
		MaxSessions:          2,
		MaxSessionsPerPlayer: 2,
		IdleTimeout:          time.Minute,
		WorkspacesDir:        t.TempDir(),
	}

	written := &logs{}
	logger := slog.New(slog.NewJSONHandler(written, nil))

	srv := New(t.Context(), cfg, logger)
	httpServer := httptest.NewServer(srv.Handler())
	t.Cleanup(httpServer.Close)

	address := "ws" + strings.TrimPrefix(httpServer.URL, "http") +
		Prefix + "/ws?ticket=" + url.QueryEscape(raw)

	conn, _, err := websocket.Dial(t.Context(), address, nil)

	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = conn.CloseNow() })

	return conn, written
}

// claimsFor builds a valid ticket's claims, the round ending at ends.
func claimsFor(ends time.Time) ticket.Claims {

	return ticket.Claims{
		Language: "python",
		Subject:  "p1",
		Expires:  time.Now().Add(time.Minute).Unix(),
		ID:       "t-" + strings.ReplaceAll(time.Now().String(), " ", ""),
		Ends:     ends.Unix(),
	}
}

// readClose reads until the service closes the socket, or gives up.
func readClose(t *testing.T, conn *websocket.Conn) error {

	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()

	for {
		if _, _, err := conn.Read(ctx); err != nil {
			return err
		}
	}
}

// expect checks some fields of a logged event.
func expect(t *testing.T, event map[string]any, want map[string]any) {

	t.Helper()

	for key, value := range want {
		if event[key] != value {
			t.Errorf("%s: got %v, want %v", key, event[key], value)
		}
	}
}

// TestFailedStartClosesTheSocket closes and logs a failed start.
func TestFailedStartClosesTheSocket(t *testing.T) {

	// no server can be found: the session fails before its ready message
	t.Setenv("PATH", "")

	claims := claimsFor(time.Now().Add(time.Hour))
	conn, written := dial(t, ticket.Sign(secret, claims))

	if err := readClose(t, conn); errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("socket left open")
	}

	event := written.event(t)

	expect(t, event, map[string]any{
		"event":      string(logging.Session),
		"level":      "ERROR",
		"outcome":    outcomeFailed,
		"reason":     "setup",
		"setup_step": "server",
		"ticket_id":  claims.ID,
		"player_id":  "p1",
		"language":   "python",
	})

	if event["error"] == nil || event["session_id"] == nil {
		t.Errorf("missing error or session_id: %v", event)
	}

	// it took a slot, so its start was logged, under the same id
	started := written.find(string(logging.SessionStarted), time.Second)

	if started == nil || started["session_id"] != event["session_id"] {
		t.Errorf("start not logged for the session: %v", started)
	}
}

// TestRoundOverRefusesAtOnce refuses an ended round's ticket, logged.
func TestRoundOverRefusesAtOnce(t *testing.T) {

	claims := claimsFor(time.Now().Add(-time.Second))
	conn, written := dial(t, ticket.Sign(secret, claims))

	err := readClose(t, conn)

	if status := websocket.CloseStatus(err); status != session.CloseRoundOver {
		t.Fatalf("want close %d, got %d (%v)", session.CloseRoundOver, status,
			err)
	}

	event := written.event(t)

	expect(t, event, map[string]any{
		"level":      "INFO",
		"outcome":    outcomeRefused,
		"reason":     "round_over",
		"close_code": float64(session.CloseRoundOver),
		"ticket_id":  claims.ID,
	})

	// refused before a slot: no load, no traffic, no start
	if _, found := event["slot"]; found {
		t.Errorf("slot logged for a refusal: %v", event)
	}

	if written.find(string(logging.SessionStarted), 0) != nil {
		t.Error("start logged for a refusal")
	}
}

// TestBadTicketIsLoggedWithoutIdentity refuses a forgery, naming nobody.
func TestBadTicketIsLoggedWithoutIdentity(t *testing.T) {

	conn, written := dial(t, "forged.ticket")

	if status := websocket.CloseStatus(readClose(t, conn)); status !=
		closeRefused {
		t.Fatalf("want close %d, got %d", closeRefused, status)
	}

	event := written.event(t)

	expect(t, event, map[string]any{
		"outcome": outcomeRefused,
		"reason":  "bad_ticket",
	})

	if _, found := event["player_id"]; found {
		t.Errorf("identity logged for a forged ticket: %v", event)
	}
}

// TestWaitHoldsShutdownForSessions checks shutdown waits for cleanups.
func TestWaitHoldsShutdownForSessions(t *testing.T) {

	srv := New(t.Context(), config.Config{MaxSessions: 1},
		slog.New(slog.DiscardHandler))

	srv.active.Add(1)

	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	if err := srv.Wait(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("returned with a session running: %v", err)
	}

	srv.active.Done()

	if err := srv.Wait(t.Context()); err != nil {
		t.Fatal(err)
	}
}

// TestHealthSaysNothingButOk checks the service's load is not public.
func TestHealthSaysNothingButOk(t *testing.T) {

	srv := New(t.Context(), config.Config{MaxSessions: 1},
		slog.New(slog.DiscardHandler))

	response := httptest.NewRecorder()
	request := httptest.NewRequest("GET", Prefix+"/health", nil)

	srv.Handler().ServeHTTP(response, request)

	if body := strings.TrimSpace(response.Body.String()); body !=
		`{"status":"ok"}` {
		t.Fatalf("health said %s", body)
	}
}

// TestPanicIsLoggedAsFailure checks a panic leaves an error with its stack.
func TestPanicIsLoggedAsFailure(t *testing.T) {

	written := &logs{}
	logger := slog.New(slog.NewJSONHandler(written, nil))

	// as connect does: emit deferred first, so it runs last
	func() {
		event := newSessionEvent(1)
		defer event.emit(logger)
		defer event.recover()

		panic("boom")
	}()

	event := written.event(t)

	expect(t, event, map[string]any{
		"level":   "ERROR",
		"outcome": outcomeFailed,
		"reason":  "panic",
		"error":   "panic: boom",
	})

	if stack, _ := event["stack"].(string); !strings.Contains(stack,
		"TestPanicIsLoggedAsFailure") {
		t.Errorf("stack misses the panic's place: %q", stack)
	}
}
