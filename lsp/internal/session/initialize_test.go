package session

// --- IMPORTS ---
import (
	"encoding/json"
	"strings"
	"testing"
)

// --- CODE ---

// TestLockInitializeReplacesOptionsAndPaths blocks smuggled options.
func TestLockInitializeReplacesOptionsAndPaths(t *testing.T) {

	raw := `{
		"jsonrpc": "2.0",
		"id": 1,
		"method": "initialize",
		"params": {
			"processId": 4242,
			"rootUri": "file:///etc",
			"rootPath": "/etc",
			"workspaceFolders": [{"uri": "file:///etc", "name": "evil"}],
			"initializationOptions": {
				"check": {"overrideCommand": ["sh", "-c", "id"]}
			},
			"capabilities": {"textDocument": {"hover": {}}}
		}
	}`

	options := json.RawMessage(`{"checkOnSave": false}`)

	out, _, drop := filterClientMessage([]byte(raw), options)

	if drop != keep {
		t.Fatal("initialize was dropped")
	}

	text := string(out)

	// the client's dangerous fields are gone
	gone := []string{"overrideCommand", "file:///etc", "4242", "rootPath"}

	for _, gone := range gone {
		if strings.Contains(text, gone) {
			t.Errorf("initialize still carries %q: %s", gone, text)
		}
	}

	// the service's options and workspace are in
	if !strings.Contains(text, "checkOnSave") {
		t.Errorf("catalog options missing: %s", text)
	}
	if !strings.Contains(text, clientRootURI) {
		t.Errorf("workspace root missing: %s", text)
	}

	// the editor's own capabilities are kept
	if !strings.Contains(text, "hover") {
		t.Errorf("client capabilities dropped: %s", text)
	}
}
