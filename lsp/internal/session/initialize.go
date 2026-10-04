package session

// --- IMPORTS ---
import (
	"encoding/json"
)

// --- CODE ---

// lockInitialize replaces the options and paths in an initialize.
func lockInitialize(
	raw json.RawMessage,
	options json.RawMessage,
) ([]byte, error) {

	// maps of raw json: only params changes, the rest goes through as is
	var message map[string]json.RawMessage

	if err := json.Unmarshal(raw, &message); err != nil {
		return nil, err
	}

	params := map[string]json.RawMessage{}

	// no params: start from an empty object
	if raw, ok := message["params"]; ok {
		if err := json.Unmarshal(raw, &params); err != nil {
			return nil, err
		}
	}

	root, _ := json.Marshal(clientRootURI)
	folders, _ := json.Marshal([]map[string]string{
		{"uri": clientRootURI, "name": "workspace"},
	})

	// our workspace only; the deprecated rootPath is dropped
	params["rootUri"] = root
	params["workspaceFolders"] = folders
	// servers exit when this pid dies: never trust the browser's
	params["processId"] = json.RawMessage("null")
	delete(params, "rootPath")

	// the options come from the catalog, never from the browser
	if len(options) > 0 {
		params["initializationOptions"] = options
	} else {
		delete(params, "initializationOptions")
	}

	// params back into the message, which is encoded whole again
	encoded, err := json.Marshal(params)

	if err != nil {
		return nil, err
	}

	message["params"] = encoded

	return json.Marshal(message)
}
