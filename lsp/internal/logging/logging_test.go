package logging

// --- IMPORTS ---
import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"testing"
	"time"

	"code-royale/lsp/internal/config"
)

// --- CODE ---

// lines parses every JSON line written.
func lines(t *testing.T, written *bytes.Buffer) []map[string]any {

	var parsed []map[string]any

	for _, line := range bytes.Split(bytes.TrimSpace(written.Bytes()),
		[]byte("\n")) {
		var fields map[string]any

		if err := json.Unmarshal(line, &fields); err != nil {
			t.Fatalf("not json: %s", line)
		}

		parsed = append(parsed, fields)
	}

	return parsed
}

// TestEveryLineSaysWhatAndWho checks the event field and the build.
func TestEveryLineSaysWhatAndWho(t *testing.T) {

	var written bytes.Buffer

	logger := New(&written, slog.LevelInfo, "1.2.3", "abc1234")

	Log(logger, slog.LevelInfo, Session, slog.String("reason", "idle"))

	line := lines(t, &written)[0]

	want := map[string]any{
		"msg":     "session",
		"event":   "session",
		"service": "lsp",
		"version": "1.2.3",
		"commit":  "abc1234",
		"reason":  "idle",
	}

	for key, value := range want {
		if line[key] != value {
			t.Errorf("%s: got %v, want %v", key, line[key], value)
		}
	}
}

// TestLifecycleEvents checks all languages on start, an error on a cut stop.
func TestLifecycleEvents(t *testing.T) {

	var written bytes.Buffer

	logger := New(&written, slog.LevelInfo, "dev", "unknown")

	LogStarted(logger, config.Config{MaxSessions: 4}, ":3001", false)
	LogStopped(logger, time.Now(), 2, errors.New("deadline exceeded"))

	parsed := lines(t, &written)
	started, stopped := parsed[0], parsed[1]

	if started["event"] != string(Started) ||
		len(started["enabled_languages"].([]any)) == 0 {
		t.Errorf("start: %v", started)
	}

	if stopped["event"] != string(Stopped) || stopped["level"] != "ERROR" ||
		stopped["sessions_ended"] != float64(2) {
		t.Errorf("stop: %v", stopped)
	}
}
