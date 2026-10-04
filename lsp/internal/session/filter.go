// Filters that keep a crafted client from turning the server into a shell.
package session

// --- IMPORTS ---
import (
	"encoding/json"
	"net/url"
	"path"
	"strings"
)

// --- GLOBALS ---

// clientMethods the editor may send; others, e.g. executeCommand, drop.
var clientMethods = map[string]bool{
	"initialize":                 true,
	"initialized":                true,
	"shutdown":                   true,
	"exit":                       true,
	"$/cancelRequest":            true,
	"$/setTrace":                 true,
	"textDocument/didOpen":       true,
	"textDocument/didChange":     true,
	"textDocument/didClose":      true,
	"textDocument/completion":    true,
	"completionItem/resolve":     true,
	"textDocument/hover":         true,
	"textDocument/signatureHelp": true,
}

// --- CODE ---

// dropReason says why a client message never reached the server.
type dropReason string

// every way a client message can be dropped
const (
	keep          dropReason = ""
	dropMalformed dropReason = "malformed"
	dropResponse  dropReason = "response"
	dropMethod    dropReason = "method"
	dropDocument  dropReason = "document"
)

// filterClientMessage returns what to forward, the method, and any drop.
func filterClientMessage(
	raw json.RawMessage,
	options json.RawMessage,
) ([]byte, string, dropReason) {

	var message rpcMessage

	// not json-rpc at all: nothing a server should parse
	if err := json.Unmarshal(raw, &message); err != nil {
		return nil, "", dropMalformed
	}

	// a response: the service answers server requests itself, so drop it
	if message.Method == "" {
		return nil, "", dropResponse
	}

	// not an editor method: could make the server run commands
	if !clientMethods[message.Method] {
		return nil, message.Method, dropMethod
	}

	// a document outside the workspace would expose other files
	if !documentInWorkspace(message) {
		return nil, message.Method, dropDocument
	}

	// the one request that carries options and paths the server may act on
	if message.Method == "initialize" {
		rewritten, err := lockInitialize(raw, options)

		// params that are not an object: nothing safe to rewrite
		if err != nil {
			return nil, message.Method, dropMalformed
		}

		return rewritten, message.Method, keep
	}

	return raw, message.Method, keep
}

// documentInWorkspace tells whether the named document is inside it.
func documentInWorkspace(message rpcMessage) bool {

	var params struct {
		TextDocument *struct {
			URI *string `json:"uri"`
		} `json:"textDocument"`
	}

	// params that are not an object carry no document
	_ = json.Unmarshal(message.Params, &params)

	// no document is fine, except for didOpen, which must name one
	if params.TextDocument == nil || params.TextDocument.URI == nil {
		return message.Method != "textDocument/didOpen"
	}

	return insideWorkspace(*params.TextDocument.URI)
}

// insideWorkspace tells whether a file uri stays inside the root.
func insideWorkspace(raw string) bool {

	parsed, err := url.Parse(raw)

	if err != nil || parsed.Scheme != "file" || parsed.Host != "" {
		return false
	}

	// decoded path: %2e%2e is caught too
	clean := path.Clean(parsed.Path)

	// unchanged by Clean means no "..", "." or "//"; then under the root
	return clean == parsed.Path && strings.HasPrefix(clean, ClientRoot+"/")
}
