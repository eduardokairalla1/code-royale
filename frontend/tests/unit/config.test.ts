/**
 * Env vars: defaults, empty values and the backend's prefix.
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
});

describe('config', () => {

  it('falls back to the page\'s own origin', async () => {
    const config = await loadConfig({});

    expect(config).toEqual({
      apiUrl: '/api',
      socketOrigin: undefined,
      socketPath: '/api/socket',
    });
  });

  it('treats empty vars as unset, as a left out build arg', async () => {
    const config = await loadConfig({ VITE_API_URL: '' });

    expect(config.apiUrl).toBe('/api');
  });

  it('reaches the backend elsewhere by its origin', async () => {
    const config = await loadConfig({
      VITE_API_URL: 'http://localhost:3000/',
    });

    expect(config).toEqual({
      apiUrl: 'http://localhost:3000/api',
      socketOrigin: 'http://localhost:3000',
      socketPath: '/api/socket',
    });
  });

  it('refuses a value that is not a url', async () => {
    await expect(loadConfig({ VITE_API_URL: 'not a url' }))
      .rejects.toThrow('Invalid env vars');
  });
});
