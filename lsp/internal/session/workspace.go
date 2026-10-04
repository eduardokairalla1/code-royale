package session

// --- IMPORTS ---
import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"code-royale/lsp/internal/languages"
)

// --- GLOBALS ---

// ClientRoot is the workspace clients see, hiding the real folder.
const ClientRoot = "/workspace"
const clientRootURI = "file://" + ClientRoot

// --- CODE ---

// workspace is the folder a session's server runs in.
type workspace struct {
	// absolute, symlinks resolved, as servers report it
	dir string
}

// newWorkspace creates a folder with the language's files.
func newWorkspace(
	root string,
	language languages.Language,
	nodeTypesDir string,
	uid int,
) (_ *workspace, err error) {

	if err := prepareRoot(root); err != nil {
		return nil, err
	}

	dir, err := os.MkdirTemp(root, "session-"+randomSuffix()+"-")

	if err != nil {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	ws := &workspace{dir: dir}

	// a half built folder never outlives a failed setup
	defer func() {
		if err != nil {
			_ = ws.remove()
		}
	}()

	// servers report real paths, e.g. /private/var on macos
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		ws.dir = resolved
	}

	if err := writeFiles(ws.dir, language, nodeTypesDir); err != nil {
		return nil, fmt.Errorf("fill workspace: %w", err)
	}

	// hand the folder to the server's user, the only one who may enter it
	if uid >= 0 {
		if err := ws.chown(uid); err != nil {
			return nil, fmt.Errorf("hand over workspace: %w", err)
		}
	}

	return ws, nil
}

// prepareRoot creates the folder every session folder goes in.
func prepareRoot(root string) error {

	if err := os.MkdirAll(root, 0o711); err != nil {
		return fmt.Errorf("create workspaces dir: %w", err)
	}

	// servers may walk into their own folder but never list the others
	if err := os.Chmod(root, 0o711); err != nil {
		return fmt.Errorf("lock workspaces dir: %w", err)
	}

	return nil
}

// writeFiles writes the program, the language's files and the cache dirs.
func writeFiles(
	dir string,
	language languages.Language,
	nodeTypesDir string,
) error {

	// the program starts empty: the client opens it with its text
	files := map[string]string{language.Document: ""}

	for path, content := range language.Files {
		files[path] = languages.FileContent(content, nodeTypesDir)
	}

	for path, content := range files {
		full := filepath.Join(dir, filepath.FromSlash(path))

		if err := os.MkdirAll(filepath.Dir(full), 0o700); err != nil {
			return err
		}

		if err := os.WriteFile(full, []byte(content), 0o600); err != nil {
			return err
		}
	}

	// caches and temp files of the server stay inside the session too
	for _, sub := range []string{".cache", ".tmp"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o700); err != nil {
			return err
		}
	}

	return nil
}

// chown gives the whole folder to the user, group included.
func (w *workspace) chown(uid int) error {

	// every file and folder, not just the root: the server writes in all
	return filepath.WalkDir(w.dir, func(path string, _ fs.DirEntry,
		err error) error {

		if err != nil {
			return err
		}

		return os.Lchown(path, uid, uid)
	})
}

// remove deletes the folder and everything the server left in it.
func (w *workspace) remove() error {
	return os.RemoveAll(w.dir)
}

// toServer rewrites the client's workspace uris into the real folder.
func (w *workspace) toServer(message []byte) []byte {

	// file:///workspace/main.py -> file:///tmp/workspaces/session-.../main.py
	return bytes.ReplaceAll(
		message,
		[]byte(clientRootURI),
		[]byte("file://"+filepath.ToSlash(w.dir)),
	)
}

// toClient maps the real folder back to the client's workspace.
func (w *workspace) toClient(message []byte) []byte {

	dir := filepath.ToSlash(w.dir)

	// uris first, then bare paths, e.g. inside error messages
	message = bytes.ReplaceAll(
		message,
		[]byte("file://"+dir),
		[]byte(clientRootURI),
	)

	return bytes.ReplaceAll(message, []byte(dir), []byte(ClientRoot))
}

// randomSuffix makes session folders hard to guess.
func randomSuffix() string {

	buffer := make([]byte, 6)
	_, _ = rand.Read(buffer)

	return hex.EncodeToString(buffer)
}
