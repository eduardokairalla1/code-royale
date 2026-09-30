// Package server serves the health check and the editors' websockets.
package server

// --- IMPORTS ---
import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"runtime"
	"sync"

	"code-royale/lsp/internal/config"
	"code-royale/lsp/internal/ledger"
)

// --- GLOBALS ---

// Prefix is where every route is served, and the public path too
const Prefix = "/lsp"

// --- CODE ---

// Server serves the health check and the language server sessions.
type Server struct {
	cfg     config.Config
	logger  *slog.Logger
	limiter *limiter
	ledger  ledger.Ledger

	// sessions run as users of their own
	isolate bool

	// ended on shutdown, ending every session with it
	sessions context.Context

	// running sessions, so shutdown can wait for their cleanup
	active sync.WaitGroup
}

// New builds the server. Cancelling sessions ends every running session.
func New(
	sessions context.Context,
	cfg config.Config,
	logger *slog.Logger,
) *Server {

	return &Server{
		cfg:      cfg,
		logger:   logger,
		limiter:  newLimiter(cfg.MaxSessions, cfg.MaxSessionsPerPlayer),
		ledger:   ledger.NewMemory(),
		isolate:  runtime.GOOS == "linux" && os.Geteuid() == 0,
		sessions: sessions,
	}
}

// Handler routes the requests.
func (s *Server) Handler() http.Handler {

	mux := http.NewServeMux()

	// under the prefix, also the public path: proxies route it as is
	mux.HandleFunc("GET "+Prefix+"/health", s.health)

	return mux
}

// Isolated tells whether sessions run as users of their own.
func (s *Server) Isolated() bool {
	return s.isolate
}

// Active is how many sessions are running.
func (s *Server) Active() int {
	return s.limiter.active()
}

// Wait blocks until every session has cleaned up, or ctx ends.
func (s *Server) Wait(ctx context.Context) error {

	done := make(chan struct{})

	go func() {
		s.active.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
