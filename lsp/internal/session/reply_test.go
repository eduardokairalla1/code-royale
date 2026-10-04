package session

// --- IMPORTS ---
import (
	"encoding/json"
	"testing"
)

// --- CODE ---

// TestServerReplyAnswersConfiguration answers configuration with nothing.
func TestServerReplyAnswersConfiguration(t *testing.T) {

	request := rpcMessage{
		ID:     json.RawMessage("7"),
		Method: "workspace/configuration",
		Params: json.RawMessage(`{"items":[{"section":"a"},{"section":"b"}]}`),
	}

	reply, handled := serverReply(request)

	if !handled {
		t.Fatal("configuration request not answered")
	}

	var parsed struct {
		ID     json.RawMessage   `json:"id"`
		Result []json.RawMessage `json:"result"`
	}

	if err := json.Unmarshal(reply, &parsed); err != nil {
		t.Fatal(err)
	}

	if string(parsed.ID) != "7" {
		t.Errorf("wrong id: %s", parsed.ID)
	}

	if len(parsed.Result) != 2 {
		t.Fatalf("want one null per item, got %d", len(parsed.Result))
	}

	for _, item := range parsed.Result {
		if string(item) != "null" {
			t.Errorf("configuration answered with %s, want null", item)
		}
	}
}

// TestServerReplyIgnoresNotificationsAndResponses answers requests only.
func TestServerReplyIgnoresNotificationsAndResponses(t *testing.T) {

	cases := []rpcMessage{
		// a notification: no id
		{Method: "window/logMessage"},
		// a response to the client: no method
		{ID: json.RawMessage("1")},
		// a request with a null id is a notification
		{ID: json.RawMessage("null"), Method: "workspace/configuration"},
	}

	for _, message := range cases {
		if _, handled := serverReply(message); handled {
			t.Errorf("answered a non-request: %+v", message)
		}
	}
}
