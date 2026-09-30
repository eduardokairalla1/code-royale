package server

// --- IMPORTS ---
import (
	"errors"
	"net/http"
	"time"

	"code-royale/lsp/internal/session"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// biggest message a client may send: a program plus some json
const maxClientMessage = 1 << 20

// websocket close codes the client can act on
const (
	closeRefused    websocket.StatusCode = 4001
	closeBusy       websocket.StatusCode = 4003
	closePlayerBusy websocket.StatusCode = 4004
)

// --- CODE ---

// connect runs one session; refusals go as close codes.
func (s *Server) connect(w http.ResponseWriter, r *http.Request) {

	s.active.Add(1)
	defer s.active.Done()

	// the connection's one log line, whatever becomes of it
	event := newSessionEvent(s.cfg.MaxSessions)
	defer event.emit(s.logger)
	defer event.recover()

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: s.cfg.AllowedOrigins,
	})

	// bad origin or not a websocket: accept already answered
	if err != nil {
		event.refuse("bad_request", 0, err)
		return
	}

	// whatever ends the session, even a failed start: never left open
	defer conn.CloseNow()

	conn.SetReadLimit(maxClientMessage)

	claims, language, err := s.authorize(r)
	event.identify(claims)

	if err != nil {
		s.refuse(conn, event, refusalCode(err), err)
		return
	}

	// caps in total and per player
	slot, err := s.limiter.acquire(claims.Subject)

	if err != nil {
		s.refuse(conn, event, busyCode(err), err)
		return
	}

	defer s.limiter.release(slot, claims.Subject)

	event.slot = slot
	event.isolated = s.isolate
	event.active = s.limiter.active()
	event.stats = &session.Stats{}
	event.emitStarted(s.logger)

	err = session.Run(s.sessions, conn, language, session.Options{
		WorkspacesDir: s.cfg.WorkspacesDir,
		NodeTypesDir:  s.cfg.NodeTypesDir,
		IdleTimeout:   s.cfg.IdleTimeout,
		Logger:        s.logger.With("session_id", event.id),
		UID:           s.sessionUID(slot),
		Deadline:      time.Unix(claims.Ends, 0),
	}, event.stats)

	event.finish(err)
}

// refuse turns a connection away with a close code, and records why.
func (s *Server) refuse(
	conn *websocket.Conn,
	event *sessionEvent,
	code websocket.StatusCode,
	err error,
) {
	event.refuse(refusalReason(err), code, err)
	_ = conn.Close(code, err.Error())
}

// sessionUID is the user a slot's server runs as; -1 when not isolated.
func (s *Server) sessionUID(slot int) int {

	// one user per slot: never shared by two running sessions
	if !s.isolate {
		return -1
	}

	return s.cfg.SessionUIDBase + slot
}

// refusalCode is the close code for a refused ticket.
func refusalCode(err error) websocket.StatusCode {

	// final either way, but the client can tell the round is over
	if errors.Is(err, session.ErrRoundOver) {
		return session.CloseRoundOver
	}

	return closeRefused
}

// busyCode is the close code for a full service or a player at their cap.
func busyCode(err error) websocket.StatusCode {

	if errors.Is(err, errPlayerFull) {
		return closePlayerBusy
	}

	return closeBusy
}
