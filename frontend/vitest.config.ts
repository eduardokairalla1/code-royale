/**
 * Vitest configuration.
 */

// --- IMPORTS ---
import { defineConfig } from 'vitest/config';

// --- GLOBALS ---
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
