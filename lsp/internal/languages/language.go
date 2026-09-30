// Package languages lists the servers and the files each one needs.
package languages

// --- IMPORTS ---
import (
	"encoding/json"
	"strings"
)

// --- GLOBALS ---

// NodeTypesPlaceholder is replaced by the configured @types folder.
const NodeTypesPlaceholder = "{{NODE_TYPES_DIR}}"

// --- CODE ---

// Language is one language server and the workspace it runs in.
type Language struct {
	// catalog id, also the lsp languageId, e.g. "python"
	ID string

	// program and arguments, run inside the workspace
	Command []string

	// the player's program, relative to the workspace root
	Document string

	// other files the server needs, by path relative to the root
	Files map[string]string

	// extra env vars, on top of the session's
	Env []string

	// handed to the client, which sends them in "initialize"
	InitializationOptions json.RawMessage
}

// FileContent returns a workspace file with its placeholders filled in.
func FileContent(content, nodeTypesDir string) string {
	return strings.ReplaceAll(content, NodeTypesPlaceholder, nodeTypesDir)
}
