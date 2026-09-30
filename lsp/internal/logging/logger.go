// Package logging is how the service logs: one JSON logger, typed events.
package logging

// --- IMPORTS ---
import (
	"io"
	"log/slog"
)

// --- CODE ---

// New builds the service's one logger; every line says which build wrote it.
func New(
	out io.Writer,
	level slog.Level,
	version string,
	commit string,
) *slog.Logger {

	handler := slog.NewJSONHandler(out, &slog.HandlerOptions{Level: level})

	return slog.New(handler).With(
		"service", "lsp",
		"version", version,
		"commit", commit,
	)
}
