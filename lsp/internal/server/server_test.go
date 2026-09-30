package server

// --- IMPORTS ---
import (
	"context"
	"errors"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"code-royale/lsp/internal/config"
)

// --- CODE ---

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
