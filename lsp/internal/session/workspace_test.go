package session

// --- IMPORTS ---
import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"code-royale/lsp/internal/languages"
)

// --- CODE ---

// TestWorkspaceHasTheLanguageFiles checks the files servers need.
func TestWorkspaceHasTheLanguageFiles(t *testing.T) {

	rust, _ := languages.Find("rust")
	ws, err := newWorkspace(t.TempDir(), rust, "/types", -1)

	if err != nil {
		t.Fatal(err)
	}

	paths := []string{"src/main.rs", "Cargo.toml", ".cache", ".tmp"}

	for _, path := range paths {
		if _, err := os.Stat(filepath.Join(ws.dir, path)); err != nil {
			t.Errorf("missing %s: %v", path, err)
		}
	}

	if err := ws.remove(); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(ws.dir); !os.IsNotExist(err) {
		t.Fatalf("workspace left behind: %v", err)
	}
}

// TestWorkspaceRemovedOnFailure checks a failed setup leaves no folder.
func TestWorkspaceRemovedOnFailure(t *testing.T) {

	root := t.TempDir()

	// the program's path is also a folder: writing one of them fails
	broken := languages.Language{
		Document: "main.py",
		Files:    map[string]string{"main.py/inner": ""},
	}

	if _, err := newWorkspace(root, broken, "/types", -1); err == nil {
		t.Fatal("want an error")
	}

	entries, err := os.ReadDir(root)

	if err != nil {
		t.Fatal(err)
	}

	if len(entries) > 0 {
		t.Fatalf("left behind: %s", entries[0].Name())
	}
}

// TestWorkspaceFillsPlaceholders checks the node types folder.
func TestWorkspaceFillsPlaceholders(t *testing.T) {

	javascript, _ := languages.Find("javascript")
	ws, err := newWorkspace(t.TempDir(), javascript, "/opt/types", -1)

	if err != nil {
		t.Fatal(err)
	}

	content, _ := os.ReadFile(filepath.Join(ws.dir, "jsconfig.json"))

	if !strings.Contains(string(content), `"/opt/types"`) {
		t.Fatalf("placeholder not filled: %s", content)
	}
}

// TestRewriteKeepsTheRealFolderPrivate checks both directions.
func TestRewriteKeepsTheRealFolderPrivate(t *testing.T) {

	ws := &workspace{dir: "/tmp/code-royale-lsp/session-abc"}

	toServer := ws.toServer([]byte(`{"uri":"file:///workspace/main.py"}`))

	wantServer := `{"uri":"file:///tmp/code-royale-lsp/session-abc/main.py"}`

	if string(toServer) != wantServer {
		t.Fatalf("to server: %s", toServer)
	}

	toClient := ws.toClient([]byte(
		`{"uri":"file:///tmp/code-royale-lsp/session-abc/main.py",` +
			`"message":"in /tmp/code-royale-lsp/session-abc/main.py"}`,
	))

	want := `{"uri":"file:///workspace/main.py",` +
		`"message":"in /workspace/main.py"}`

	if string(toClient) != want {
		t.Fatalf("to client: %s", toClient)
	}
}
