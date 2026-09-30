package server

// --- IMPORTS ---
import (
	"encoding/json"
	"net/http"
)

// --- CODE ---

// health answers ok; how busy the service is stays in the logs.
func (s *Server) health(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
