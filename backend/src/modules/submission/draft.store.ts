/**
 * Players' drafts in Redis, apart from the room: they change while typing.
 */

// --- IMPORTS ---
import type { RedisClient } from '../../shared/redis/redis.js';
import type { Draft } from '../game/game.types.js';

// --- GLOBALS ---
// drafts outlive their round only for a while
const DRAFTS_TTL_MS = 24 * 60 * 60 * 1000;

// --- CODE ---
/**
 * The latest code of each player, one hash per round.
 */
export class DraftStore {

  /**
   * Create the store.
   *
   * @param {RedisClient} redis The Redis client.
   */
  constructor(private readonly redis: RedisClient) {}

  /**
   * Keep a player's draft for a round.
   *
   * @param {string} code The room code.
   * @param {number} startedAt When the round started, which names it.
   * @param {string} playerId Whose draft it is.
   * @param {Draft} draft The language and the code.
   *
   * @returns {Promise<void>}
   */
  async save(
    code: string,
    startedAt: number,
    playerId: string,
    draft: Draft,
  ): Promise<void> {

    const key = draftsKey(code, startedAt);

    await this.redis.multi()
      .hSet(key, playerId, JSON.stringify(draft))
      .pExpire(key, DRAFTS_TTL_MS)
      .exec();
  }

  /**
   * Every draft of a round.
   *
   * @param {string} code The room code.
   * @param {number} startedAt When the round started.
   *
   * @returns {Promise<Map<string, Draft>>} The drafts by player id.
   */
  async getAll(code: string, startedAt: number): Promise<Map<string, Draft>> {

    const stored = await this.redis.hGetAll(draftsKey(code, startedAt));

    return new Map(Object.entries(stored).map(([playerId, json]) => {
      return [playerId, JSON.parse(json) as Draft];
    }));
  }
}

/**
 * The key of a round's drafts.
 *
 * @param {string} code The room code.
 * @param {number} startedAt When the round started.
 *
 * @returns {string} The key.
 */
function draftsKey(code: string, startedAt: number): string {
  return `drafts:${code}:${startedAt}`;
}
