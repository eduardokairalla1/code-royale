/**
 * Vite configuration.
 */

// --- IMPORTS ---
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// --- GLOBALS ---
// rarely changing libraries get their own chunks, cached across deploys
const VENDOR_GROUPS = [
  {
    name: 'react',
    test: vendor('react', 'react-dom', 'react-router', 'scheduler'),
  },
  { name: 'motion', test: vendor('motion', 'motion-dom', 'framer-motion') },
  { name: 'monaco', test: vendor('monaco-editor', '@monaco-editor/react') },
];

// --- CODE ---
/**
 * Match the modules of the given packages.
 *
 * @param {string[]} packages The package names.
 *
 * @returns {RegExp} A test for their paths inside node_modules.
 */
function vendor(...packages: string[]): RegExp {

  const names = packages.map((name) => name.replace('/', '[\\\\/]'));

  return new RegExp(`node_modules[\\\\/](${names.join('|')})[\\\\/]`);
}

// build config
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },

    // NOTE: the editor alone is ~3 MB and only loads once a round starts.
    chunkSizeWarningLimit: 3500,
  },
});
