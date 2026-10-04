package session

// --- IMPORTS ---
import (
	"encoding/json"
)

// --- CODE ---

// serverReply answers the server's requests: configuration with nothing.
func serverReply(message rpcMessage) ([]byte, bool) {

	// notifications and responses need no answer
	if message.Method == "" || !message.isRequest() {
		return nil, false
	}

	// null is a valid answer to anything: enough to keep the server going
	result := json.RawMessage("null")

	if message.Method == "workspace/configuration" {
		result = configurationResult(message.Params)
	}

	// a json-rpc response to the server's own request id
	reply, _ := json.Marshal(map[string]json.RawMessage{
		"jsonrpc": json.RawMessage(`"2.0"`),
		"id":      message.ID,
		"result":  result,
	})

	return reply, true
}

// configurationResult answers each requested setting with null.
func configurationResult(raw json.RawMessage) json.RawMessage {

	var params struct {
		Items []json.RawMessage `json:"items"`
	}

	_ = json.Unmarshal(raw, &params)

	// the protocol wants one answer per item, in order
	nulls := make([]json.RawMessage, len(params.Items))

	for i := range nulls {
		nulls[i] = json.RawMessage("null")
	}

	result, _ := json.Marshal(nulls)

	return result
}
