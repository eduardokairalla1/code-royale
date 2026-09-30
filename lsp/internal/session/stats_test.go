package session

// --- IMPORTS ---
import (
	"fmt"
	"testing"
)

// --- CODE ---

// TestDroppedMethodsAreCapped checks a flood of names keeps a small list.
func TestDroppedMethodsAreCapped(t *testing.T) {

	var stats Stats

	for i := range 50 {
		stats.dropped(dropMethod, fmt.Sprintf("custom/%d", i))
	}

	// the same name again, and a response without one
	stats.dropped(dropMethod, "custom/0")
	stats.dropped(dropResponse, "")

	if got := len(stats.DroppedMethods()); got != maxMethods {
		t.Errorf("kept %d methods, want %d", got, maxMethods)
	}

	if got := stats.MessagesDrop.Load(); got != 52 {
		t.Errorf("counted %d drops, want 52", got)
	}
}

// TestDropsAreCountedByReason checks the breakdown and what is suspicious.
func TestDropsAreCountedByReason(t *testing.T) {

	var stats Stats

	stats.dropped(dropMethod, "workspace/executeCommand")
	stats.dropped(dropMethod, "workspace/executeCommand")
	stats.dropped(dropMalformed, "")

	if stats.Suspicious() {
		t.Error("suspicious without a document outside the workspace")
	}

	stats.dropped(dropDocument, "textDocument/didOpen")

	drops := stats.Drops()

	if drops["method"] != 2 || drops["malformed"] != 1 ||
		drops["document"] != 1 {
		t.Errorf("drops: %v", drops)
	}

	if !stats.Suspicious() {
		t.Error("a document outside the workspace is suspicious")
	}
}

// TestServerRequestsKeepTheirMethods checks what the server asked for.
func TestServerRequestsKeepTheirMethods(t *testing.T) {

	var stats Stats

	stats.serverRequested("workspace/configuration")
	stats.serverRequested("workspace/configuration")
	stats.serverRequested("client/registerCapability")

	if got := stats.ServerRequests.Load(); got != 3 {
		t.Errorf("counted %d requests, want 3", got)
	}

	if got := stats.RequestMethods(); len(got) != 2 {
		t.Errorf("methods: %v", got)
	}
}
