// Package recovery turns panics into errors, so they reach the logs.
package recovery

// --- IMPORTS ---
import (
	"errors"
	"fmt"
	"runtime/debug"
)

// --- GLOBALS ---

// ErrPanic is what every recovered panic unwraps to.
var ErrPanic = errors.New("panic")

// --- CODE ---

// Error is a recovered panic, with the stack where it happened.
type Error struct {
	Value any
	Stack string
}

// New captures a panic's value and the current stack.
func New(value any) *Error {
	return &Error{Value: value, Stack: string(debug.Stack())}
}

// Error says what panicked.
func (e *Error) Error() string {
	return fmt.Sprintf("panic: %v", e.Value)
}

// Unwrap makes errors.Is(err, ErrPanic) match.
func (e *Error) Unwrap() error {
	return ErrPanic
}
