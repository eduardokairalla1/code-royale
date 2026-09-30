package session

// --- IMPORTS ---
import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// --- GLOBALS ---

// sweeps killUser makes: a forking process may leave a child behind
const killSweeps = 10

// --- CODE ---

// processAttributes isolates the server: own group, own uid if set.
func processAttributes(uid int) *syscall.SysProcAttr {

	attributes := &syscall.SysProcAttr{
		Setpgid:   true,
		Pdeathsig: syscall.SIGKILL,
	}

	if uid >= 0 {
		attributes.Credential = &syscall.Credential{
			Uid:    uint32(uid),
			Gid:    uint32(uid),
			Groups: []uint32{},
		}
	}

	return attributes
}

// killUser kills every process left by the user, counting them.
func killUser(uid int) int {

	// not isolated: no user of its own to sweep
	if uid < 0 {
		return 0
	}

	total := 0

	for range killSweeps {
		killed := killOwnedBy(uid)
		total += killed

		// nothing left alive: done before the last sweep
		if killed == 0 {
			break
		}
	}

	return total
}

// killOwnedBy sends SIGKILL to each process of the user, counting them.
func killOwnedBy(uid int) int {

	entries, _ := os.ReadDir("/proc")
	killed := 0

	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())

		if err != nil {
			continue
		}

		// zombies are dead already: they only wait to be reaped
		if owner, zombie := ownerOf(pid); owner != uid || zombie {
			continue
		}

		if syscall.Kill(pid, syscall.SIGKILL) == nil {
			killed++
		}
	}

	return killed
}

// ownerOf returns a process's uid, -1 if gone, and if it is a zombie.
func ownerOf(pid int) (int, bool) {

	status, err := os.ReadFile(
		filepath.Join("/proc", strconv.Itoa(pid), "status"),
	)

	if err != nil {
		return -1, false
	}

	uid, zombie := -1, false

	// "State:\tZ (zombie)", "Uid:\t<real>\t<effective>\t<saved>\t<fs>"
	for line := range strings.SplitSeq(string(status), "\n") {
		fields := strings.Fields(line)

		// not a "key value" line
		if len(fields) < 2 {
			continue
		}

		switch fields[0] {
		case "State:":
			zombie = fields[1] == "Z"
		case "Uid:":
			if value, err := strconv.Atoi(fields[1]); err == nil {
				uid = value
			}
		}
	}

	return uid, zombie
}
