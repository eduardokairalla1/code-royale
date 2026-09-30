package session

// --- IMPORTS ---
import (
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"code-royale/lsp/internal/languages"
)

// --- CODE ---

// TestStopKillsHelpersOfAnExitedServer reaps it and kills its helpers.
func TestStopKillsHelpersOfAnExitedServer(t *testing.T) {

	// the "server" leaves a helper behind, holding stdout and stderr
	language := languages.Language{
		ID:       "sh",
		Document: "main.sh",
		Command: []string{
			"sh", "-c", "sleep 30 & echo $! > helper.pid; exit 0",
		},
	}

	ws, err := newWorkspace(t.TempDir(), language, "", -1)

	if err != nil {
		t.Fatal(err)
	}

	srv, err := startServer(ws, language, -1, slog.New(slog.DiscardHandler))

	if err != nil {
		t.Fatal(err)
	}

	select {
	case <-srv.exited:
	case <-time.After(pipesDelay + 3*time.Second):
		t.Fatal("server never reaped")
	}

	raw, err := os.ReadFile(filepath.Join(ws.dir, "helper.pid"))

	if err != nil {
		t.Fatal(err)
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))

	if err != nil {
		t.Fatal(err)
	}

	srv.stop()

	// signal 0 only checks the process exists; reaping may take a moment
	deadline := time.Now().Add(2 * time.Second)

	for syscall.Kill(pid, 0) == nil {
		if time.Now().After(deadline) {
			_ = syscall.Kill(pid, syscall.SIGKILL)
			t.Fatal("helper survived")
		}

		time.Sleep(50 * time.Millisecond)
	}
}
