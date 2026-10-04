package session

// --- IMPORTS ---
import (
	"code-royale/lsp/internal/recovery"
	"context"
	"errors"
)

// --- GLOBALS ---

// ErrClientLeft ends a session whose browser went away.
var ErrClientLeft = errors.New("client left")

// ErrServerExited ends a session whose language server died on its own.
var ErrServerExited = errors.New("server exited")

// ErrServerProtocol ends a session whose server broke the message framing.
var ErrServerProtocol = errors.New("server broke the protocol")

// ErrMessageTooBig ends a session whose client sent more than the limit.
var ErrMessageTooBig = errors.New("client message too big")

// every known ending, by the error that caused it; checked in order
var reasons = []struct {
	cause error
	name  string
}{
	{ErrIdle, "idle"},
	{ErrRoundOver, "round_over"},
	{ErrClientLeft, "client_left"},
	{ErrMessageTooBig, "message_too_big"},
	{ErrServerExited, "server_exited"},
	{ErrServerProtocol, "server_protocol_error"},
	{recovery.ErrPanic, "panic"},

	// the service is shutting down and ended every session
	{context.Canceled, "shutdown"},
}

// --- CODE ---

// Reason names why a session ended, for logs: a small, fixed set.
func Reason(err error) string {

	if err == nil {
		return "done"
	}

	for _, reason := range reasons {
		if errors.Is(err, reason.cause) {
			return reason.name
		}
	}

	// none of the above: something no one planned for
	return "error"
}
