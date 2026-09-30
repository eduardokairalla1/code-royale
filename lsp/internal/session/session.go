// Package session relays one browser to one language server.
package session

// --- IMPORTS ---
import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"code-royale/lsp/internal/languages"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// ErrRoundOver ends a session whose round is over.
var ErrRoundOver = errors.New("round over")

// CloseRoundOver ends a session whose round is over: no reconnect.
const CloseRoundOver websocket.StatusCode = 4009

// --- CODE ---

// Options are the settings every session shares.
type Options struct {
	WorkspacesDir string
	NodeTypesDir  string
	IdleTimeout   time.Duration
	Logger        *slog.Logger

	// user the server runs as, one per slot; -1 keeps the service's own
	UID int

	// when the round ends and the session with it; zero never
	Deadline time.Time
}

// Run relays a websocket and a new language server, filling stats.
func Run(
	ctx context.Context,
	conn *websocket.Conn,
	language languages.Language,
	options Options,
	stats *Stats,
) error {

	stats.started = time.Now()

	// runs last, after every other cleanup below: how long stopping took
	defer func() {
		if !stats.stopping.IsZero() {
			stats.StopDuration = time.Since(stats.stopping)
		}
	}()

	// the folder the server works in
	stats.SetupStep = "workspace"

	ws, err := newWorkspace(options.WorkspacesDir, language,
		options.NodeTypesDir, options.UID)

	if err != nil {
		return err
	}

	// the folder goes with the session, whatever ended it
	defer func() {
		if err := ws.remove(); err != nil {
			stats.CleanupError = err.Error()
		}
	}()

	// the language server process
	stats.SetupStep = "server"

	server, err := startServer(ws, language, options.UID, options.Logger)

	if err != nil {
		return err
	}

	// kill what the user left behind before the slot is reused
	defer func() {
		stats.LeftoverProcesses = killUser(options.UID)
	}()
	defer server.stop()

	// every goroutine below ends the session by cancelling with its cause
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	// the round is over: nothing left to complete
	if !options.Deadline.IsZero() {
		var stopDeadline context.CancelFunc

		ctx, stopDeadline = context.WithDeadlineCause(ctx, options.Deadline,
			ErrRoundOver)
		defer stopDeadline()
	}

	// the server is ready to receive messages
	stats.SetupStep = "ready"

	if err := sendReady(ctx, conn, language); err != nil {
		return err
	}

	// set up: from here on the session only relays until something ends it
	stats.SetupStep = ""
	stats.SetupDuration = time.Since(stats.started)

	activity := make(chan struct{}, 1)
	var relays sync.WaitGroup

	// NOTE: not tied to ctx, or the socket drops before its close code.
	relayCtx := context.WithoutCancel(ctx)

	// browser -> server, only the editor's own messages get through
	relays.Go(func() {
		defer recovered(cancel)
		cancel(relayToServer(relayCtx, conn, server, ws,
			language.InitializationOptions, activity, stats))
	})

	// server -> browser, the service answering the server's requests itself
	relays.Go(func() {
		defer recovered(cancel)
		cancel(relayToClient(relayCtx, conn, server, ws, stats))
	})

	// the server may die on its own
	go func() {
		<-server.exited
		cancel(ErrServerExited)
	}()

	// a panic in any of them ends this session only
	go func() {
		defer recovered(cancel)
		watchIdle(ctx, cancel, activity, options.IdleTimeout)
	}()

	go func() {
		defer recovered(cancel)
		keepAlive(ctx, conn)
	}()

	// the first cause wins: client gone, server gone, idle, round over...
	<-ctx.Done()

	cause := context.Cause(ctx)
	stats.stopping = time.Now()

	// unblock both relays
	server.stop()

	// died on its own: keep how, e.g. "signal: killed"
	if errors.Is(cause, ErrServerExited) {
		stats.ServerExit = server.exitStatus()
	}

	stats.CloseCode = closeFor(conn, cause)
	relays.Wait()

	return cause
}

// closeFor closes the socket with the code the client acts on, or zero.
func closeFor(conn *websocket.Conn, cause error) websocket.StatusCode {

	switch {
	case errors.Is(cause, ErrIdle):
		_ = conn.Close(CloseIdle, "idle")
		return CloseIdle
	case errors.Is(cause, ErrRoundOver):
		_ = conn.Close(CloseRoundOver, "round over")
		return CloseRoundOver

	// the library already closed it with 1009 when the read limit hit
	case errors.Is(cause, ErrMessageTooBig):
		_ = conn.CloseNow()
		return websocket.StatusMessageTooBig

	// the client left or the server died
	default:
		_ = conn.CloseNow()
		return 0
	}
}
