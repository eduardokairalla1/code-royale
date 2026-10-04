/**
 * Locks held in Redis, so only one instance does a piece of work.
 */

// --- IMPORTS ---
import type { RedisClient } from './redis.js';
import { randomUUID } from 'node:crypto';

// --- GLOBALS ---
// deletes the lock only while it is still ours
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

// --- CODE ---
/**
 * Take a lock that frees itself after a while, in case its holder dies.
 *
 * @param {RedisClient} redis The Redis client.
 * @param {string} key The lock's key.
 * @param {number} ttlMs When it frees itself.
 *
 * @returns {Promise<string | null>} The token to release it, or null when
 *                                   someone else holds it.
 */
export async function acquireLock(
  redis: RedisClient,
  key: string,
  ttlMs: number,
): Promise<string | null> {

  const token = randomUUID();
  const taken = await redis.set(key, token, { NX: true, PX: ttlMs });

  return taken === null ? null : token;
}

/**
 * Release a lock, unless it expired and someone else took it.
 *
 * @param {RedisClient} redis The Redis client.
 * @param {string} key The lock's key.
 * @param {string} token What acquireLock returned.
 *
 * @returns {Promise<void>}
 */
export async function releaseLock(
  redis: RedisClient,
  key: string,
  token: string,
): Promise<void> {

  await redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] });
}
