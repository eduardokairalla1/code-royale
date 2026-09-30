package server

// --- IMPORTS ---
import (
	"errors"
	"net/http"
	"time"

	"code-royale/lsp/internal/languages"
	"code-royale/lsp/internal/session"
	"code-royale/lsp/internal/ticket"
)

// --- GLOBALS ---

// errLanguageUnavailable refuses a language this deployment does not run.
var errLanguageUnavailable = errors.New("language not available")

// --- CODE ---

// authorize checks the ticket; claims return whenever it was genuine.
func (s *Server) authorize(
	r *http.Request,
) (ticket.Claims, languages.Language, error) {

	claims, err := ticket.Verify(
		s.cfg.Secret,
		r.URL.Query().Get("ticket"),
		time.Now(),
	)

	if err != nil {
		return ticket.Claims{}, languages.Language{}, err
	}

	// the round ended in the meantime: no server worth starting
	if time.Now().After(time.Unix(claims.Ends, 0)) {
		return claims, languages.Language{}, session.ErrRoundOver
	}

	// one session per ticket: a copied or logged ticket opens nothing
	expires := time.Unix(claims.Expires, 0)

	if err := s.ledger.Spend(r.Context(), claims.ID, expires); err != nil {
		return claims, languages.Language{}, err
	}

	language, found := languages.Find(claims.Language)

	if !found || !s.cfg.LanguageEnabled(language.ID) {
		return claims, languages.Language{}, errLanguageUnavailable
	}

	return claims, language, nil
}
