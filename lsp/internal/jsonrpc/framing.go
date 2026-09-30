// Package jsonrpc frames stdio messages: Content-Length, blank line, body.
package jsonrpc

// --- IMPORTS ---
import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// --- GLOBALS ---

// MaxMessageSize guards against a broken server announcing huge bodies.
const MaxMessageSize = 16 << 20

// ErrProtocol is a message that breaks the framing, not a closed pipe.
var ErrProtocol = errors.New("broken framing")

// --- CODE ---

// ReadMessage reads the next message body from a server's stdout.
func ReadMessage(reader *bufio.Reader) ([]byte, error) {

	length, err := readContentLength(reader)

	if err != nil {
		return nil, err
	}

	if length > MaxMessageSize {
		return nil, fmt.Errorf("%w: message of %d bytes is too big",
			ErrProtocol, length)
	}

	body := make([]byte, length)

	if _, err := io.ReadFull(reader, body); err != nil {
		return nil, err
	}

	return body, nil
}

// readContentLength reads the headers and returns the body's length.
func readContentLength(reader *bufio.Reader) (int, error) {

	length := -1

	for {
		// capped at the reader's buffer: a server gone wrong cannot grow it
		raw, err := reader.ReadSlice('\n')

		if errors.Is(err, bufio.ErrBufferFull) {
			return 0, fmt.Errorf("%w: header line too long", ErrProtocol)
		}

		if err != nil {
			return 0, err
		}

		line := strings.TrimRight(string(raw), "\r\n")

		// the blank line ends the headers
		if line == "" {
			break
		}

		name, value, found := strings.Cut(line, ":")

		// other headers, e.g. Content-Type, carry nothing we need
		if !found || !strings.EqualFold(strings.TrimSpace(name),
			"Content-Length") {
			continue
		}

		length, err = strconv.Atoi(strings.TrimSpace(value))

		if err != nil {
			return 0, fmt.Errorf("%w: bad Content-Length %q", ErrProtocol,
				value)
		}
	}

	if length < 0 {
		return 0, fmt.Errorf("%w: message without Content-Length",
			ErrProtocol)
	}

	return length, nil
}

// WriteMessage writes one message body to a server's stdin.
func WriteMessage(writer io.Writer, body []byte) error {

	header := "Content-Length: " + strconv.Itoa(len(body)) + "\r\n\r\n"

	if _, err := io.WriteString(writer, header); err != nil {
		return err
	}

	_, err := writer.Write(body)

	return err
}
