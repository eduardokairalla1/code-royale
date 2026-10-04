/**
 * A cap on work running at once across every instance.
 */

// --- IMPORTS ---
import type { RedisClient } from './redis.js';

// --- GLOBALS ---
// drop the slots of holders that died, then take one if any is free
const ACQUIRE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

// --- CODE ---
/**
 * Slots in a sorted set, each with a deadline, so a dead holder frees its.
 */
export class Semaphore {

  /**
   * Create the semaphore.
   *
   * @param {RedisClient} redis The Redis client.
   * @param {string} key The sorted set holding the slots.
   * @param {number} slots How many may hold one at once.
   * @param {number} ttlMs When an unreleased slot frees itself.
   */
  constructor(
    private readonly redis: RedisClient,
    private readonly key: string,
    private readonly slots: number,
    private readonly ttlMs: number,
  ) {}

  /**
   * Take a slot.
   *
   * @param {string} holder Who takes it, unique per holder.
   *
   * @returns {Promise<boolean>} False when every slot is taken.
   */
  async acquire(holder: string): Promise<boolean> {

    const now = Date.now();

    const taken = await this.redis.eval(ACQUIRE_SCRIPT, {
      keys: [this.key],
      arguments: [
        String(now),
        String(now + this.ttlMs),
        String(this.slots),
        holder,
        String(this.ttlMs),
      ],
    });

    return taken === 1;
  }

  /**
   * Give a slot back.
   *
   * @param {string} holder Who took it.
   *
   * @returns {Promise<void>}
   */
  async release(holder: string): Promise<void> {
    await this.redis.zRem(this.key, holder);
  }

  /**
   * Count the slots taken.
   *
   * @returns {Promise<number>} How many are held.
   */
  async count(): Promise<number> {
    return this.redis.zCount(this.key, Date.now(), '+inf');
  }
}
