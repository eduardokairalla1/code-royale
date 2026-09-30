/**
 * Vite configuration.
 */

// --- IMPORTS ---
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// --- CODE ---
// build config
export default defineConfig({
  plugins: [react()],
});
