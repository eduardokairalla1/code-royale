/**
 * Vitest configuration.
 */

// --- IMPORTS ---
import { defineConfig } from 'vitest/config';

// --- GLOBALS ---
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // the tests need a Redis: the one of the dev compose by default
    env: {
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
  },
});
