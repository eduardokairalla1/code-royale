package session

// --- IMPORTS ---
import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"code-royale/lsp/internal/jsonrpc"
	"code-royale/lsp/internal/languages"

	"github.com/coder/websocket"
)

// --- GLOBALS ---

// ReadyMethod is the first message a client gets: where its program lives.
const ReadyMethod = "codeRoyale/ready"

// --- CODE ---

// readyParams tells the client how to open its program.
type readyParams struct {
	RootURI     string          `json:"rootUri"`
	DocumentURI string          `json:"documentUri"`
	LanguageID  string          `json:"languageId"`
	Options     json.RawMessage `json:"initializationOptions,omitempty"`
}

// sendReady tells the client where its program lives.
func sendReady(
	ctx context.Context,
	conn *websocket.Conn,
	language languages.Language,
) error {

	message, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"method":  ReadyMethod,
		"params": readyParams{
			RootURI:     clientRootURI,
			DocumentURI: clientRootURI + "/" + language.Document,
			LanguageID:  language.ID,
			Options:     language.InitializationOptions,
		},
	})

	if err != nil {
		return err
	}

	return conn.Write(ctx, websocket.MessageText, message)
}

// relayToServer forwards allowed client messages, with our own options.
func relayToServer(
	ctx context.Context,
	conn *websocket.Conn,
	srv *languageServer,
	ws *workspace,
	options json.RawMessage,
	activity chan<- struct{},
	stats *Stats,
) error {

	for {
		kind, message, err := conn.Read(ctx)

		// over the read limit: the library already closed the socket
		if errors.Is(err, websocket.ErrMessageTooBig) {
			return fmt.Errorf("%w: %w", ErrMessageTooBig, err)
		}

		// any other read error: the browser is gone
		if err != nil {
			return fmt.Errorf("%w: %w", ErrClientLeft, err)
		}

		// lsp is text; binary frames carry nothing a server reads
		if kind != websocket.MessageText {
			continue
		}

		markActive(activity)
		stats.MessagesIn.Add(1)

		forward, method, drop := filterClientMessage(message, options)

		// dropped: counted by why, never reaches the server
		if drop != keep {
			stats.dropped(drop, method)
			continue
		}

		// the server sees its real folder, never /workspace
		if err := srv.write(ws.toServer(forward)); err != nil {
			return fmt.Errorf("%w: %w", ErrServerExited, err)
		}
	}
}

// markActive tells the idle watch a message arrived, without waiting.
func markActive(activity chan<- struct{}) {

	// one pending signal is enough: the watch only needs to know
	select {
	case activity <- struct{}{}:
	default:
	}
}

// relayToClient forwards server messages, answering its requests itself.
func relayToClient(
	ctx context.Context,
	conn *websocket.Conn,
	srv *languageServer,
	ws *workspace,
	stats *Stats,
) error {

	for {
		message, err := jsonrpc.ReadMessage(srv.stdout)

		// alive but speaking nonsense: not the same as a server gone
		if errors.Is(err, jsonrpc.ErrProtocol) {
			return fmt.Errorf("%w: %w", ErrServerProtocol, err)
		}

		// the pipe closed: the server is gone
		if err != nil {
			return fmt.Errorf("%w: %w", ErrServerExited, err)
		}

		// only the method and id matter here; the body goes through as is
		var parsed rpcMessage
		_ = json.Unmarshal(message, &parsed)

		// server requests, e.g. workspace/configuration, are answered here
		if reply, handled := serverReply(parsed); handled {
			stats.serverRequested(parsed.Method)

			if err := srv.write(reply); err != nil {
				return fmt.Errorf("%w: %w", ErrServerExited, err)
			}

			continue
		}

		// the browser only ever sees /workspace, never the real folder
		if err := conn.Write(ctx, websocket.MessageText,
			ws.toClient(message)); err != nil {
			return fmt.Errorf("%w: %w", ErrClientLeft, err)
		}

		stats.MessagesOut.Add(1)
		stats.replied()
	}
}
