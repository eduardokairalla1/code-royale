package session

// --- IMPORTS ---
import (
	"encoding/json"
)

// --- CODE ---

// rpcMessage is the part of a json-rpc message the filter reads.
type rpcMessage struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// isRequest tells whether the message has an id, so expects an answer.
func (m rpcMessage) isRequest() bool {
	return len(m.ID) > 0 && string(m.ID) != "null"
}
