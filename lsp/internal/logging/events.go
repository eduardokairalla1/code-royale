package logging

// --- IMPORTS ---
import (
	"context"
	"log/slog"
)

// --- GLOBALS ---

// every event the service logs; filter on the "event" field
const (
	Started        Event = "started"
	Stopped        Event = "stopped"
	SessionStarted Event = "session_started"
	Session        Event = "session"
	ServerStderr   Event = "server_stderr"
)

// --- CODE ---

// Event names what happened: the only way a line gets written.
type Event string

// Log writes one event, its name in both msg and the "event" field.
func Log(
	logger *slog.Logger,
	level slog.Level,
	event Event,
	attrs ...slog.Attr,
) {
	attrs = append([]slog.Attr{slog.String("event", string(event))}, attrs...)
	logger.LogAttrs(context.Background(), level, string(event), attrs...)
}
