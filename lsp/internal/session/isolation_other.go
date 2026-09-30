//go:build !linux

package session

// --- IMPORTS ---
import (
	"syscall"
)

// --- CODE ---

// processAttributes puts the server in its own group. Dev only.
func processAttributes(_ int) *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true}
}

// killUser does nothing outside linux: no per session users.
func killUser(_ int) int {
	return 0
}
