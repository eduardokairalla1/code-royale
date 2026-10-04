/**
 * Env vars: parsing, defaults and refusals.
 */

// --- IMPORTS ---
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
 * @returns {Promise<any>} The parsed config.
 */
async function loadConfig(env: Record<string, string>): Promise<any> {

  vi.resetModules();

  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }

  return (await import('../../src/config.js')).config;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config', () => {

  it('falls back to the defaults', async () => {
    const config = await loadConfig({});

    expect(config).toMatchObject({
      logLevel: 'debug',
      corsOrigins: ['http://localhost:5173'],
      reconnectGraceMs: 10_000,
      maxPlayersPerRoom: 20,
      maxRooms: 1000,
    });
  });

  it('splits comma separated lists, ignoring spaces and blanks', async () => {
    const config = await loadConfig({
      CORS_ORIGIN: 'https://a.com, https://b.br,,',
    });

    expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.br']);
  });

  it('turns seconds into milliseconds', async () => {
    const config = await loadConfig({
      RECONNECT_GRACE_SECONDS: '30',
    });

    expect(config.reconnectGraceMs).toBe(30_000);
  });

  it.each([
    [{ LOG_LEVEL: 'verbose' }, /LOG_LEVEL/],
    [{ MAX_PLAYERS_PER_ROOM: '0' }, /MAX_PLAYERS_PER_ROOM/],
    [{ CORS_ORIGIN: ' , ' }, /CORS_ORIGIN/],
  ])('refuses %j on boot', async (env, reason) => {
    await expect(loadConfig(env)).rejects.toThrow(reason);
  });
});
