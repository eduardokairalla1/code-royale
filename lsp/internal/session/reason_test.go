package session

// --- IMPORTS ---
import (
	"code-royale/lsp/internal/recovery"
	"context"
	"errors"
	"fmt"
	"testing"
)

// --- CODE ---

// TestReasonNamesEveryEnding checks wrapped causes map to fixed names.
func TestReasonNamesEveryEnding(t *testing.T) {

	cases := map[error]string{
		nil:                                     "done",
		ErrIdle:                                 "idle",
		ErrRoundOver:                            "round_over",
		context.Canceled:                        "shutdown",
		errors.New("boom"):                      "error",
		fmt.Errorf("%w: eof", ErrClientLeft):    "client_left",
		fmt.Errorf("%w: pipe", ErrServerExited): "server_exited",
		fmt.Errorf("%w: x", ErrServerProtocol):  "server_protocol_error",
		fmt.Errorf("%w: x", ErrMessageTooBig):   "message_too_big",
		recovery.New("boom"):                    "panic",
	}

	for err, want := range cases {
		if got := Reason(err); got != want {
			t.Errorf("Reason(%v) = %q, want %q", err, got, want)
		}
	}
}
