package ticket

// --- IMPORTS ---
import (
	"errors"
	"strings"
	"testing"
	"time"
)

// --- GLOBALS ---

const secret = "0123456789abcdef0123456789abcdef"

// --- CODE ---

// valid builds claims with every required field set.
func valid(language string, expires int64) Claims {
	return Claims{Language: language, Expires: expires, ID: "t1", Ends: 1900}
}

// TestVerifyAcceptsGenuineTickets checks the round trip with the backend.
func TestVerifyAcceptsGenuineTickets(t *testing.T) {

	now := time.Unix(1000, 0)
	raw := Sign(secret, Claims{
		Language: "python",
		Subject:  "p1",
		Expires:  1060,
		ID:       "t1",
		Ends:     1900,
	})

	claims, err := Verify(secret, raw, now)

	if err != nil {
		t.Fatalf("genuine ticket refused: %v", err)
	}

	if claims.Language != "python" || claims.Subject != "p1" {
		t.Fatalf("wrong claims: %+v", claims)
	}
}

// TestVerifyRefusesForgedTickets checks tampering and other secrets.
func TestVerifyRefusesForgedTickets(t *testing.T) {

	now := time.Unix(1000, 0)
	raw := Sign(secret, valid("python", 1060))
	payload, sig, _ := strings.Cut(raw, ".")
	other := Sign(secret, valid("java", 1060))
	otherPayload, _, _ := strings.Cut(other, ".")

	otherSecret := strings.Repeat("x", 32)

	cases := map[string]string{
		"another secret":  Sign(otherSecret, valid("python", 1060)),
		"swapped payload": otherPayload + "." + sig,
		"no signature":    payload,
		"garbage":         "not-a-ticket",
		"empty":           "",
		"no id": Sign(secret, Claims{
			Language: "python", Expires: 1060, Ends: 1900,
		}),
		"no end": Sign(secret, Claims{
			Language: "python", Expires: 1060, ID: "t1",
		}),
	}

	for name, forged := range cases {
		if _, err := Verify(secret, forged, now); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: want ErrInvalid, got %v", name, err)
		}
	}
}

// TestVerifyRefusesExpiredTickets checks the expiry.
func TestVerifyRefusesExpiredTickets(t *testing.T) {

	raw := Sign(secret, valid("python", 1000))

	// late by a fraction of a second: the ledger has forgotten it by then
	for _, now := range []time.Time{time.Unix(1000, 1), time.Unix(1001, 0)} {
		if _, err := Verify(secret, raw, now); !errors.Is(err, ErrExpired) {
			t.Fatalf("at %v: want ErrExpired, got %v", now, err)
		}
	}
}
