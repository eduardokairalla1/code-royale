// Package redistest hands tests a Redis of their own keys.
package redistest

// --- IMPORTS ---
import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"

	"code-royale/lsp/internal/redisclient"

	"github.com/redis/go-redis/v9"
)

// --- CODE ---

// Client connects to REDIS_URL, the dev compose's by default, and returns
// a key prefix only this test uses; its keys are dropped after it.
func Client(t *testing.T) (*redis.Client, string) {

	t.Helper()

	url := os.Getenv("REDIS_URL")

	if url == "" {
		url = "redis://localhost:6379"
	}

	client, err := redisclient.Connect(url)

	if err != nil {
		t.Fatalf("%s: %v", url, err)
	}

	buffer := make([]byte, 8)
	_, _ = rand.Read(buffer)
	prefix := "test:" + hex.EncodeToString(buffer) + ":"

	t.Cleanup(func() {
		ctx := context.Background()
		keys, _ := client.Keys(ctx, prefix+"*").Result()

		if len(keys) > 0 {
			client.Del(ctx, keys...)
		}

		_ = client.Close()
	})

	return client, prefix
}
