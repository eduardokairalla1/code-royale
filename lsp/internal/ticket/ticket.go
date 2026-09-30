// Package ticket verifies the backend's HMAC signed, one-use tickets.
package ticket

// --- IMPORTS ---
import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// --- GLOBALS ---

// ErrInvalid is returned for any ticket that cannot be trusted.
var ErrInvalid = errors.New("invalid ticket")

// ErrExpired is returned for a genuine ticket used too late.
var ErrExpired = errors.New("expired ticket")

// --- CODE ---

// Claims is what the backend vouches for.
type Claims struct {

	// language id from the catalog, e.g. "python"
	Language string `json:"lang"`

	// player id, for the logs
	Subject string `json:"sub"`

	// unix seconds after which the ticket is refused
	Expires int64 `json:"exp"`

	// unique id, so the ticket opens one session only
	ID string `json:"jti"`

	// unix seconds when the round, and so the session, ends
	Ends int64 `json:"end"`
}

// Sign builds a ticket, as the backend does. Used by the tests.
func Sign(secret string, claims Claims) string {

	payload, _ := json.Marshal(claims)
	encoded := base64.RawURLEncoding.EncodeToString(payload)

	return encoded + "." + signature(secret, encoded)
}

// Verify checks a ticket's signature and expiry, and returns its claims.
func Verify(secret, raw string, now time.Time) (Claims, error) {

	encoded, sig, found := strings.Cut(raw, ".")

	// not "<payload>.<signature>"
	if !found {
		return Claims{}, ErrInvalid
	}

	// constant time, so the signature cannot be guessed byte by byte
	if !hmac.Equal([]byte(sig), []byte(signature(secret, encoded))) {
		return Claims{}, ErrInvalid
	}

	// signed by the backend, so a bad payload is a bug, still refused
	payload, err := base64.RawURLEncoding.DecodeString(encoded)

	if err != nil {
		return Claims{}, ErrInvalid
	}

	var claims Claims

	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, ErrInvalid
	}

	// without them: no server to start, no single use, no end
	if claims.Language == "" || claims.ID == "" || claims.Ends <= 0 {
		return Claims{}, ErrInvalid
	}

	// genuine but late: told apart for the logs
	if now.After(time.Unix(claims.Expires, 0)) {
		return Claims{}, ErrExpired
	}

	return claims, nil
}

// signature is the base64url HMAC-SHA256 of a payload.
func signature(secret, payload string) string {

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))

	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
