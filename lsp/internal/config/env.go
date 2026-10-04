package config

// --- IMPORTS ---
import (
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// --- CODE ---

// env reads a var, falling back when unset or blank.
func env(name, fallback string) string {

	value := strings.TrimSpace(os.Getenv(name))

	if value == "" {
		return fallback
	}

	return value
}

// positiveInt reads a var holding a positive integer.
func positiveInt(name string, fallback int) (int, error) {

	raw := env(name, strconv.Itoa(fallback))
	value, err := strconv.Atoi(raw)

	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s: must be a positive integer, got %q",
			name, raw)
	}

	return value, nil
}

// logLevel turns a level name into its slog level.
func logLevel(raw string) (slog.Level, error) {

	var level slog.Level

	if err := level.UnmarshalText([]byte(raw)); err != nil {
		return 0, fmt.Errorf("LOG_LEVEL: use debug, info, warn or error")
	}

	return level, nil
}

// origins turns "http://a:1, https://b" into the hosts websocket checks.
func origins(raw string) ([]string, error) {

	var hosts []string

	for _, item := range commaList(raw) {
		parsed, err := url.Parse(item)

		// hosts only: websocket matches the origin's host
		if err != nil || parsed.Host == "" {
			return nil, fmt.Errorf("CORS_ORIGIN: %q is not an origin", item)
		}

		hosts = append(hosts, parsed.Host)
	}

	if len(hosts) == 0 {
		return nil, errors.New("CORS_ORIGIN: list at least one origin")
	}

	return hosts, nil
}

// commaList turns "a, b,,c" into ["a", "b", "c"].
func commaList(raw string) []string {

	var items []string

	for item := range strings.SplitSeq(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}

	return items
}

// defaultWorkspacesDir is a folder inside the system temp dir.
func defaultWorkspacesDir() string {
	return filepath.Join(os.TempDir(), "code-royale-lsp")
}
