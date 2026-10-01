/**
 * Submitted code of the last round, fetched once per player.
 */

// --- IMPORTS ---
import type { Draft } from './game.types.ts';

// --- CODE ---
/**
 * Fetches each player's submitted code once.
 */
export interface SubmissionCache {
  get: (playerId: string) => Promise<Draft>;
}

/**
 * Wrap a fetch so reopening a player's code does not ask the server again.
 *
 * @param {(playerId: string) => Promise<Draft>} fetchCode Asks the server.
 *
 * @returns {SubmissionCache} The cache.
 */
export function createSubmissionCache(
  fetchCode: (playerId: string) => Promise<Draft>,
): SubmissionCache {

  const pending = new Map<string, Promise<Draft>>();

  return {
    get(playerId) {

      const cached = pending.get(playerId);

      if (cached) {
        return cached;
      }

      // failed: let the next try ask again
      const request = fetchCode(playerId).catch((error: unknown) => {
        pending.delete(playerId);
        throw error;
      });

      pending.set(playerId, request);

      return request;
    },
  };
}
