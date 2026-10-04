package session

// --- IMPORTS ---
import (
	"context"
	"errors"
	"time"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// pings keep proxies like Cloudflare from closing silent sockets
const pingInterval = 30 * time.Second

// ErrIdle ends a session nobody typed in for too long.
var ErrIdle = errors.New("idle for too long")

// CloseIdle ends an idle session; the client waits to reconnect.
const CloseIdle websocket.StatusCode = 4008

// --- CODE ---

// watchIdle ends the session once no client message arrived for too long.
func watchIdle(
	ctx context.Context,
	cancel context.CancelCauseFunc,
	activity <-chan struct{},
	timeout time.Duration,
) {

	// rearmed on every client message; firing means nobody typed in time
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-activity:
			timer.Reset(timeout)
		case <-timer.C:
			cancel(ErrIdle)
			return
		}
	}
}

// keepAlive pings the client; pongs never reset the idle timer.
func keepAlive(ctx context.Context, conn *websocket.Conn) {

	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// not tied to the session, or a cut ping drops the close code
			ping, cancel := context.WithTimeout(context.WithoutCancel(ctx),
				pingInterval)

			// no pong: the relays notice the dead socket on their own
			_ = conn.Ping(ping)
			cancel()
		}
	}
}
