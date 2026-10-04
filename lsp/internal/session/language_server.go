package session

// --- IMPORTS ---
import (
	"bufio"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"code-royale/lsp/internal/jsonrpc"
	"code-royale/lsp/internal/languages"
	"code-royale/lsp/internal/logging"
)

// --- GLOBALS ---

// how long Wait waits for children still holding the server's pipes
const pipesDelay = 2 * time.Second

// toolchainVars are the image's settings every server may need.
var toolchainVars = []string{
	"RUSTUP_HOME",
	"JAVA_HOME",
	"JDTLS_HOME",
}

// --- CODE ---

// languageServer is a running language server process.
type languageServer struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader

	// both relays write to stdin: client messages and the service's replies
	writeMu sync.Mutex

	// closed once the process is reaped
	exited chan struct{}
	once   sync.Once
}

// startServer starts the language server inside the workspace.
func startServer(
	ws *workspace,
	language languages.Language,
	uid int,
	logger *slog.Logger,
) (*languageServer, error) {

	// the server, in the session's folder, with a clean env, isolated
	cmd := exec.Command(language.Command[0], language.Command[1:]...)
	cmd.Dir = ws.dir
	cmd.Env = sessionEnv(ws.dir, language)
	cmd.SysProcAttr = processAttributes(uid)

	// helpers that outlive the server must not keep it from being reaped
	cmd.WaitDelay = pipesDelay

	// lsp over stdio: we write its stdin and read its stdout
	stdin, err := cmd.StdinPipe()

	if err != nil {
		return nil, err
	}

	stdout, err := cmd.StdoutPipe()

	if err != nil {
		return nil, err
	}

	// the server's own logs: kept at debug level
	cmd.Stderr = &logWriter{logger: logger, language: language.ID}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start %s: %w", language.Command[0], err)
	}

	srv := &languageServer{
		cmd:   cmd,
		stdin: stdin,
		// 64 KB: also the longest header line jsonrpc accepts
		stdout: bufio.NewReaderSize(stdout, 64<<10),
		exited: make(chan struct{}),
	}

	// reap it whenever it ends, killed or on its own
	go func() {
		_ = cmd.Wait()
		close(srv.exited)
	}()

	return srv, nil
}

// write sends one message to the server, guarding the shared stdin.
func (s *languageServer) write(body []byte) error {

	// two writers at once would interleave their bytes into garbage
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	return jsonrpc.WriteMessage(s.stdin, body)
}

// stop kills the server and its children, and waits. Safe to repeat.
func (s *languageServer) stop() {

	s.once.Do(func() {

		// the whole group, even with the server gone: its helpers may not be
		_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGKILL)

		<-s.exited
	})
}

// exitStatus says how the ended process ended, e.g. "exit status 1".
func (s *languageServer) exitStatus() string {

	if s.cmd.ProcessState == nil {
		return ""
	}

	return s.cmd.ProcessState.String()
}

// sessionEnv builds the env from scratch, so no service secret leaks.
func sessionEnv(dir string, language languages.Language) []string {

	// home, temp and caches all inside the session's own folder
	env := []string{
		"PATH=" + os.Getenv("PATH"),
		"LANG=C.UTF-8",
		"HOME=" + dir,
		"TMPDIR=" + filepath.Join(dir, ".tmp"),
		"XDG_CACHE_HOME=" + filepath.Join(dir, ".cache"),
		"XDG_CONFIG_HOME=" + filepath.Join(dir, ".cache"),
		"XDG_DATA_HOME=" + filepath.Join(dir, ".cache"),
		"GOPATH=" + filepath.Join(dir, ".cache", "go"),
		"GOCACHE=" + filepath.Join(dir, ".cache", "go-build"),
		"CARGO_HOME=" + filepath.Join(dir, ".cache", "cargo"),
	}

	// toolchain locations set by the image
	for _, name := range toolchainVars {
		if value, ok := os.LookupEnv(name); ok {
			env = append(env, name+"="+value)
		}
	}

	// last, so a language may override any of the above
	return append(env, language.Env...)
}

// logWriter turns a server's stderr into debug logs, one per line.
type logWriter struct {
	logger   *slog.Logger
	language string
}

// Write logs each non-empty line written.
func (w *logWriter) Write(chunk []byte) (int, error) {

	// a chunk may hold several lines, or blank ones: one event per line
	for line := range strings.SplitSeq(string(chunk), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			logging.Log(w.logger, slog.LevelDebug, logging.ServerStderr,
				slog.String("language", w.language),
				slog.String("line", line))
		}
	}

	return len(chunk), nil
}
