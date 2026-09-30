package logging

// --- IMPORTS ---
import (
	"log/slog"
	"time"

	"code-royale/lsp/internal/config"
	"code-royale/lsp/internal/languages"
)

// --- CODE ---

// LogStarted records the service starting, with its settings, no secret.
func LogStarted(
	logger *slog.Logger,
	cfg config.Config,
	addr string,
	isolated bool,
) {

	// unset means every language
	enabled := cfg.EnabledLanguages

	if len(enabled) == 0 {
		enabled = languages.IDs()
	}

	Log(logger, slog.LevelInfo, Started,
		slog.String("addr", addr),
		slog.Int("max_sessions", cfg.MaxSessions),
		slog.Int("max_sessions_per_player", cfg.MaxSessionsPerPlayer),
		slog.Int("idle_timeout_s", int(cfg.IdleTimeout.Seconds())),
		slog.Any("enabled_languages", enabled),
		slog.Any("allowed_origins", cfg.AllowedOrigins),
		slog.Bool("isolated", isolated),
	)
}

// LogStopped records the service stopping; an error if sessions were cut.
func LogStopped(
	logger *slog.Logger,
	started time.Time,
	running int,
	cleanup error,
) {

	attrs := []slog.Attr{
		slog.Int("uptime_s", int(time.Since(started).Seconds())),
		slog.Int("sessions_ended", running),
	}

	// sessions still cleaning up when the time ran out
	if cleanup != nil {
		attrs = append(attrs, slog.String("error", cleanup.Error()))
		Log(logger, slog.LevelError, Stopped, attrs...)
		return
	}

	Log(logger, slog.LevelInfo, Stopped, attrs...)
}
