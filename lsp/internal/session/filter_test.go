package session

// --- IMPORTS ---
import (
	"testing"
)

// --- CODE ---

// TestFilterDropsUnsafeMethods drops what could run commands.
func TestFilterDropsUnsafeMethods(t *testing.T) {

	unsafe := []struct {
		raw  string
		want dropReason
	}{
		{`{"jsonrpc":"2.0","method":"workspace/executeCommand"}`, dropMethod},
		{`{"jsonrpc":"2.0","method":"workspace/didChangeConfiguration"}`,
			dropMethod},
		{`{"jsonrpc":"2.0","method":"textDocument/didSave"}`, dropMethod},
		{`{"jsonrpc":"2.0","method":"workspace/symbol"}`, dropMethod},

		// a response: the service answers the server itself
		{`{"jsonrpc":"2.0","id":1,"result":{"overrideCommand":["x"]}}`,
			dropResponse},

		// not even json
		{`not json`, dropMalformed},
	}

	for _, test := range unsafe {
		_, _, drop := filterClientMessage([]byte(test.raw), nil)

		if drop != test.want {
			t.Errorf("%s: dropped as %q, want %q", test.raw, drop, test.want)
		}
	}
}

// TestFilterKeepsEditorMethods checks the messages the editor relies on.
func TestFilterKeepsEditorMethods(t *testing.T) {

	safe := []string{
		`{"jsonrpc":"2.0","method":"initialized","params":{}}`,
		`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{}}`,
		`{"jsonrpc":"2.0","id":2,"method":"textDocument/completion"}`,
		`{"jsonrpc":"2.0","id":3,"method":"textDocument/hover"}`,
	}

	for _, raw := range safe {
		if _, _, drop := filterClientMessage([]byte(raw), nil); drop != keep {
			t.Errorf("dropped an editor message: %s", raw)
		}
	}
}

// TestFilterKeepsDocumentsInWorkspace refuses files outside it.
func TestFilterKeepsDocumentsInWorkspace(t *testing.T) {

	message := func(method, uri string) string {
		return `{"jsonrpc":"2.0","id":1,"method":"` + method +
			`","params":{"textDocument":{"uri":"` + uri + `"}}}`
	}

	outside := []string{
		message("textDocument/didOpen", "file:///proc/1/environ"),
		message("textDocument/didOpen", "file:///workspace/../proc/1/environ"),
		message("textDocument/didOpen", "file:///workspace/%2e%2e/etc/passwd"),
		message("textDocument/didOpen", "file:///workspace2/main.py"),
		message("textDocument/didOpen", "file:///workspace"),
		message("textDocument/didOpen", "file://host/workspace/main.py"),
		message("textDocument/didOpen", "untitled:///workspace/main.py"),
		message("textDocument/hover", "file:///tmp/workspaces/x/main.py"),
		// didOpen without a document
		`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{}}`,
	}

	for _, raw := range outside {
		_, _, drop := filterClientMessage([]byte(raw), nil)

		if drop != dropDocument {
			t.Errorf("%s: dropped as %q, want %q", raw, drop, dropDocument)
		}
	}

	inside := []string{
		message("textDocument/didOpen", "file:///workspace/main.py"),
		message("textDocument/completion", "file:///workspace/src/main.rs"),
	}

	for _, raw := range inside {
		if _, _, drop := filterClientMessage([]byte(raw), nil); drop != keep {
			t.Errorf("dropped a workspace document: %s", raw)
		}
	}
}
