// Package redisclient opens the connection to Redis, shared by the
// ledger and the leases.
package redisclient

// --- IMPORTS ---
import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// --- GLOBALS ---

// how long reaching redis may take
const connectTimeout = 5 * time.Second

// --- CODE ---

// Connect opens a client to the url and checks redis answers.
func Connect(url string) (*redis.Client, error) {

	options, err := redis.ParseURL(url)

	if err != nil {
		return nil, fmt.Errorf("REDIS_URL: %w", err)
	}

	client := redis.NewClient(options)

	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis: %w", err)
	}

	return client, nil
}
