package jsonrpc

// --- IMPORTS ---
import (
	"bufio"
	"bytes"
	"errors"
	"strings"
	"testing"
)

// --- CODE ---

// TestRoundTrip checks that written messages read back whole, in order.
func TestRoundTrip(t *testing.T) {

	var buffer bytes.Buffer

	messages := []string{`{"id":1}`, `{"method":"ção ☃"}`, `{}`}

	for _, message := range messages {
		if err := WriteMessage(&buffer, []byte(message)); err != nil {
			t.Fatal(err)
		}
	}

	reader := bufio.NewReader(&buffer)

	for _, want := range messages {
		got, err := ReadMessage(reader)

		if err != nil {
			t.Fatal(err)
		}

		if string(got) != want {
			t.Fatalf("got %q, want %q", got, want)
		}
	}
}

// TestReadSkipsOtherHeaders checks headers servers may add.
func TestReadSkipsOtherHeaders(t *testing.T) {

	raw := "Content-Type: application/vscode-jsonrpc\r\n" +
		"content-length: 2\r\n\r\n{}"

	got, err := ReadMessage(bufio.NewReader(strings.NewReader(raw)))

	if err != nil || string(got) != "{}" {
		t.Fatalf("got %q, %v", got, err)
	}
}

// TestReadRefusesBrokenHeaders checks missing and oversized lengths.
func TestReadRefusesBrokenHeaders(t *testing.T) {

	cases := map[string]string{
		"no length":  "Content-Type: x\r\n\r\n{}",
		"bad length": "Content-Length: abc\r\n\r\n{}",
		"too big":    "Content-Length: 999999999\r\n\r\n",
	}

	for name, raw := range cases {
		reader := bufio.NewReader(strings.NewReader(raw))

		if _, err := ReadMessage(reader); err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
}

// TestReadRefusesHugeHeaders checks a line without end cannot grow forever.
func TestReadRefusesHugeHeaders(t *testing.T) {

	// valid otherwise: only the size of the first header is wrong
	message := "X-Pad: " + strings.Repeat("x", 5000) +
		"\r\nContent-Length: 2\r\n\r\n{}"
	reader := bufio.NewReaderSize(strings.NewReader(message), 1024)

	if _, err := ReadMessage(reader); !errors.Is(err, ErrProtocol) {
		t.Fatalf("want ErrProtocol, got %v", err)
	}
}

// TestClosedPipeIsNotAProtocolError tells a gone server from a broken one.
func TestClosedPipeIsNotAProtocolError(t *testing.T) {

	reader := bufio.NewReader(strings.NewReader(""))

	if _, err := ReadMessage(reader); errors.Is(err, ErrProtocol) {
		t.Fatalf("an empty pipe is a closed one: %v", err)
	}
}
