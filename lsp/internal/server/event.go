package server

// --- IMPORTS ---
import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"time"

	"code-royale/lsp/internal/leases"
	"code-royale/lsp/internal/ledger"
	"code-royale/lsp/internal/logging"
	"code-royale/lsp/internal/recovery"
	"code-royale/lsp/internal/session"
	"code-royale/lsp/internal/ticket"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// what became of a connection
const (
	outcomeRefused = "refused"
	outcomeFailed  = "failed"
	outcomeEnded   = "ended"
)

// --- CODE ---

// sessionEvent is the one log line a connection leaves, filled as it goes.
type sessionEvent struct {
	started time.Time
	id      string

	// from the ticket, once it checks out
	ticketID string
	playerID string
	language string

	outcome   string
	reason    string
	setupStep string
	err       error
	closeCode websocket.StatusCode

	// the service's load when the session took its slot
	slot     int
	isolated bool
	active   int
	max      int

	stats *session.Stats
}

// newSessionEvent starts the event of a new connection.
func newSessionEvent(maxSessions int) *sessionEvent {
	return &sessionEvent{
		started: time.Now(),
		id:      newSessionID(),
		slot:    -1,
		max:     maxSessions,
	}
}

// identify records who the ticket says is connecting.
func (e *sessionEvent) identify(claims ticket.Claims) {
	e.ticketID = claims.ID
	e.playerID = claims.Subject
	e.language = claims.Language
}

// refuse records a connection turned away before any session started.
func (e *sessionEvent) refuse(
	reason string,
	code websocket.StatusCode,
	err error,
) {
	e.outcome = outcomeRefused
	e.reason = reason
	e.closeCode = code
	e.err = err
}

// finish records how a session that ran ended.
func (e *sessionEvent) finish(err error) {

	e.closeCode = e.stats.CloseCode

	// never got its ready message: the setup is what broke, at its step
	if !e.stats.Ready() {
		e.outcome, e.reason, e.err = outcomeFailed, "setup", err
		e.setupStep = e.stats.SetupStep
		return
	}

	e.outcome, e.reason = outcomeEnded, session.Reason(err)

	// the expected endings need no error text
	if e.broken() {
		e.err = err
	}
}

// recover logs a panic of the connection's goroutine; deferred after emit.
func (e *sessionEvent) recover() {

	if value := recover(); value != nil {
		e.outcome, e.reason, e.err = outcomeFailed, "panic",
			recovery.New(value)
	}
}

// broken tells whether the session ended because something broke.
func (e *sessionEvent) broken() bool {

	switch e.reason {
	case "error", "server_exited", "server_protocol_error", "panic":
		return true
	default:
		return e.outcome == outcomeFailed
	}
}

// suspicious tells whether the client tried what an editor never does.
func (e *sessionEvent) suspicious() bool {
	return e.reason == "message_too_big" ||
		(e.stats != nil && e.stats.Suspicious())
}

// emitStarted marks a session taking its slot, so long ones show up live.
func (e *sessionEvent) emitStarted(logger *slog.Logger) {

	logging.Log(logger, slog.LevelInfo, logging.SessionStarted,
		slog.String("session_id", e.id),
		slog.String("ticket_id", e.ticketID),
		slog.String("player_id", e.playerID),
		slog.String("language", e.language),
		slog.Int("slot", e.slot),
		slog.Bool("isolated", e.isolated),
		slog.Int("active_sessions", e.active),
		slog.Int("max_sessions", e.max),
	)
}

// emit writes the event: an error when the service or a server broke.
func (e *sessionEvent) emit(logger *slog.Logger) {

	level := slog.LevelInfo

	// broken first: a crash outranks a suspicious client
	switch {
	case e.broken():
		level = slog.LevelError
	case e.suspicious():
		level = slog.LevelWarn
	}

	logging.Log(logger, level, logging.Session, e.attrs()...)
}

// attrs are the event's fields; empty ones are left out.
func (e *sessionEvent) attrs() []slog.Attr {

	attrs := []slog.Attr{
		slog.String("session_id", e.id),
		slog.String("outcome", e.outcome),
		slog.String("reason", e.reason),
		slog.Int64("duration_ms", time.Since(e.started).Milliseconds()),
		slog.Int("close_code", int(e.closeCode)),
	}

	attrs = appendSet(attrs, "setup_step", e.setupStep)
	attrs = appendSet(attrs, "ticket_id", e.ticketID)
	attrs = appendSet(attrs, "player_id", e.playerID)
	attrs = appendSet(attrs, "language", e.language)

	if e.err != nil {
		attrs = append(attrs, slog.String("error", e.err.Error()))
	}

	// a panic also says where it happened
	var panicked *recovery.Error

	if errors.As(e.err, &panicked) {
		attrs = append(attrs, slog.String("stack", panicked.Stack))
	}

	// refused before taking a slot: nothing else happened
	if e.slot < 0 {
		return attrs
	}

	attrs = append(attrs,
		slog.Int("slot", e.slot),
		slog.Bool("isolated", e.isolated),
		slog.Int("active_sessions", e.active),
		slog.Int("max_sessions", e.max),
	)

	if e.stats != nil {
		attrs = append(attrs, statsAttrs(e.stats)...)
	}

	return attrs
}

// statsAttrs are the fields of what the session itself saw.
func statsAttrs(stats *session.Stats) []slog.Attr {

	attrs := []slog.Attr{
		slog.Int64("setup_ms", stats.SetupDuration.Milliseconds()),
		slog.Int64("first_reply_ms", stats.FirstReply.Milliseconds()),
		slog.Int64("stop_ms", stats.StopDuration.Milliseconds()),
		slog.Int64("messages_in", stats.MessagesIn.Load()),
		slog.Int64("messages_out", stats.MessagesOut.Load()),
		slog.Int64("messages_dropped", stats.MessagesDrop.Load()),
		slog.Int64("server_requests", stats.ServerRequests.Load()),
		slog.Int("leftover_processes", stats.LeftoverProcesses),
	}

	// lists only when they have something: most sessions never drop a thing
	if drops := stats.Drops(); len(drops) > 0 {
		attrs = append(attrs, slog.Any("drops", drops))
	}

	if methods := stats.DroppedMethods(); len(methods) > 0 {
		attrs = append(attrs, slog.Any("dropped_methods", methods))
	}

	if methods := stats.RequestMethods(); len(methods) > 0 {
		attrs = append(attrs, slog.Any("server_request_methods", methods))
	}

	attrs = appendSet(attrs, "server_exit", stats.ServerExit)

	return appendSet(attrs, "cleanup_error", stats.CleanupError)
}

// appendSet adds a string field, unless it is empty.
func appendSet(attrs []slog.Attr, key, value string) []slog.Attr {

	if value == "" {
		return attrs
	}

	return append(attrs, slog.String(key, value))
}

// refusalReason names why a connection was turned away: a fixed set.
func refusalReason(err error) string {

	switch {
	case errors.Is(err, ticket.ErrExpired):
		return "expired_ticket"
	case errors.Is(err, ticket.ErrInvalid):
		return "bad_ticket"
	case errors.Is(err, ledger.ErrSpent):
		return "spent_ticket"
	case errors.Is(err, session.ErrRoundOver):
		return "round_over"
	case errors.Is(err, errLanguageUnavailable):
		return "language_unavailable"
	case errors.Is(err, leases.ErrFull):
		return "player_busy"
	case errors.Is(err, errServerFull):
		return "busy"
	default:
		return "error"
	}
}

// newSessionID makes the id that ties a session's log lines together.
func newSessionID() string {

	buffer := make([]byte, 8)
	_, _ = rand.Read(buffer)

	return hex.EncodeToString(buffer)
}
