// Command lsp runs a language server per editor, for autocomplete.
package main

// --- IMPORTS ---
import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"code-royale/lsp/internal/config"
	"code-royale/lsp/internal/logging"
	"code-royale/lsp/internal/redisclient"
	"code-royale/lsp/internal/server"
)

// --- GLOBALS ---

// how long open requests get to finish on shutdown
const shutdownTimeout = 5 * time.Second

// set at build time with -ldflags "-X main.version=... -X main.commit=..."
var (
	version = "dev"
	commit  = "unknown"
)

// --- CODE ---

// main starts the service and exits with an error code if it fails.
func main() {

	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// run serves until docker (SIGTERM) or the terminal (SIGINT) asks to stop.
func run() error {

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logging.New(os.Stdout, cfg.LogLevel, version, commit)

	client, err := redisclient.Connect(cfg.RedisURL)

	if err != nil {
		return err
	}

	defer client.Close()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM,
		os.Interrupt)
	defer stop()

	// every session ends with the service
	sessions, endSessions := context.WithCancel(context.Background())
	defer endSessions()

	srv := server.New(sessions, cfg, logger)

	httpServer := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	serveErr := make(chan error, 1)

	started := time.Now()

	go func() {
		serveErr <- httpServer.ListenAndServe()
	}()

	logging.LogStarted(logger, cfg, httpServer.Addr, srv.Isolated())

	select {

	// could not even listen
	case err := <-serveErr:
		return err

	// asked to stop: end the sessions, then the server
	case <-ctx.Done():
	}

	running := srv.Active()

	endSessions()

	shutdown, cancel := context.WithTimeout(context.Background(),
		shutdownTimeout)
	defer cancel()

	err = httpServer.Shutdown(shutdown)

	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	// websockets are not waited for by Shutdown: let sessions clean up
	cleanup := srv.Wait(shutdown)

	logging.LogStopped(logger, started, running, cleanup)

	return nil
}
