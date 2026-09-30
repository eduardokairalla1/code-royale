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
      maxPlayersPerRoom: 20,
    });
  });

  it.each([
    [{ MAX_PLAYERS_PER_ROOM: '0' }, /MAX_PLAYERS_PER_ROOM/],
  ])('refuses %j on boot', async (env, reason) => {
    await expect(loadConfig(env)).rejects.toThrow(reason);
  });
});
