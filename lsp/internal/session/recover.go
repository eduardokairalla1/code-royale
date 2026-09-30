package session

// --- IMPORTS ---
import (
	"context"

	"code-royale/lsp/internal/recovery"
)

// --- CODE ---

// recovered ends the session on a goroutine's panic, not the service.
func recovered(cancel context.CancelCauseFunc) {

	if value := recover(); value != nil {
		cancel(recovery.New(value))
	}
}
