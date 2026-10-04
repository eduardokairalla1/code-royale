/**
 * Env vars: defaults, empty values and the services' prefixes.
 */

// --- IMPORTS ---
import type { config as Config } from '../../src/config.ts';
import { afterEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- CODE ---
/**
 * Load the config from scratch with the given env vars.
 *
 * @param {Record<string, string>} env The env vars to set.
 *
 * @returns {Promise<typeof Config>} The parsed config.
 */
async function loadConfig(
  env: Record<string, string>,
): Promise<typeof Config> {

  vi.resetModules();

  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }

  return (await import('../../src/config.ts')).config;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('config', () => {

  it('falls back to the page\'s own origin', async () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'example.com' });

    const config = await loadConfig({});

    expect(config).toEqual({
      apiUrl: '/api',
      socketOrigin: undefined,
      socketPath: '/api/socket',
      lspUrl: 'wss://example.com/lsp',
    });
  });

  it('reaches the lsp service over plain websockets on http', async () => {
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:8080' });

    const config = await loadConfig({});

    expect(config.lspUrl).toBe('ws://localhost:8080/lsp');
  });

  it('treats empty vars as unset, as a left out build arg', async () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'example.com' });

    const config = await loadConfig({ VITE_API_URL: '', VITE_LSP_URL: '' });

    expect(config.apiUrl).toBe('/api');
    expect(config.lspUrl).toBe('wss://example.com/lsp');
  });

  it('reaches services elsewhere by their origin', async () => {
    const config = await loadConfig({
      VITE_API_URL: 'http://localhost:3000/',
      VITE_LSP_URL: 'ws://localhost:3001',
    });

    expect(config).toEqual({
      apiUrl: 'http://localhost:3000/api',
      socketOrigin: 'http://localhost:3000',
      socketPath: '/api/socket',
      lspUrl: 'ws://localhost:3001/lsp',
    });
  });

  it('turns autocomplete off', async () => {
    const config = await loadConfig({ VITE_LSP_URL: 'off' });

    expect(config.lspUrl).toBeNull();
  });

  it('refuses a value that is not a url', async () => {
    await expect(loadConfig({ VITE_API_URL: 'not a url' }))
      .rejects.toThrow('Invalid env vars');
  });
});
