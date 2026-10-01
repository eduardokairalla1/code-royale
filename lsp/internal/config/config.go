// Package config reads the settings from env vars, failing on boot.
package config

// --- IMPORTS ---
import (
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"
)

// --- CODE ---

// Config is every setting of the service.
type Config struct {
	Host     string
	Port     int
	LogLevel slog.Level

	// shared with the backend, which signs the tickets
	Secret string

	// spent tickets and sessions per player, shared by every instance
	RedisURL string
	// prepended to every key, so apps can share one Redis
	RedisKeyPrefix string

	// hosts browsers may connect from, e.g. "localhost:5173"
	AllowedOrigins []string

	// sessions at once, in total and per player
	MaxSessions          int
	MaxSessionsPerPlayer int
	IdleTimeout          time.Duration

	// first uid sessions run as, one per slot; only when running as root
	SessionUIDBase int

	// empty means every language of the catalog
	EnabledLanguages []string

	// where each session gets its own folder
	WorkspacesDir string

	// @types folder handed to javascript sessions, for node completions
	NodeTypesDir string
}

// Load reads and validates the env vars.
func Load() (Config, error) {

	var problems []error

	// collect every bad var instead of stopping at the first one
	check := func(err error) {
		if err != nil {
			problems = append(problems, err)
		}
	}

	cfg := Config{
		Host:           env("HOST", "0.0.0.0"),
		Secret:         env("LSP_SECRET", ""),
		RedisURL:       env("REDIS_URL", ""),
		RedisKeyPrefix: env("REDIS_KEY_PREFIX", "code-royale:"),
		WorkspacesDir:  env("WORKSPACES_DIR", defaultWorkspacesDir()),
		NodeTypesDir:   env("NODE_TYPES_DIR", "/opt/lsp/node_modules/@types"),
	}

	var err error

	cfg.Port, err = positiveInt("PORT", 3001)
	check(err)

	cfg.MaxSessions, err = positiveInt("MAX_SESSIONS", 16)
	check(err)

	cfg.MaxSessionsPerPlayer, err = positiveInt("MAX_SESSIONS_PER_PLAYER", 2)
	check(err)

	cfg.SessionUIDBase, err = positiveInt("SESSION_UID_BASE", 20000)
	check(err)

	idleSeconds, err := positiveInt("IDLE_TIMEOUT_SECONDS", 600)
	check(err)
	cfg.IdleTimeout = time.Duration(idleSeconds) * time.Second

	cfg.LogLevel, err = logLevel(env("LOG_LEVEL", "info"))
	check(err)

	cfg.AllowedOrigins, err = origins(
		env("CORS_ORIGIN", "http://localhost:5173"),
	)
	check(err)

	cfg.EnabledLanguages = commaList(env("ENABLED_LANGUAGES", ""))

	// every instance must see the same spent tickets
	if cfg.RedisURL == "" {
		check(errors.New("REDIS_URL: required"))
	}

	// a short secret makes the tickets guessable
	if len(cfg.Secret) < 32 {
		check(errors.New("LSP_SECRET: must have at least 32 characters"))
	}

	if len(problems) > 0 {
		return Config{}, fmt.Errorf("invalid env vars:\n%w",
			errors.Join(problems...))
	}

	return cfg, nil
}

// LanguageEnabled tells whether a language may be used in this deployment.
func (c Config) LanguageEnabled(id string) bool {
	return len(c.EnabledLanguages) == 0 ||
		slices.Contains(c.EnabledLanguages, id)
}
