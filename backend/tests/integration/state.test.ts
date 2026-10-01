/**
 * Redis building blocks: atomic room changes, timers, locks and slots.
 */

// --- IMPORTS ---
import { acquireLock } from '../../src/shared/redis/lock.js';
import { releaseLock } from '../../src/shared/redis/lock.js';
import type { RedisClient } from '../../src/shared/redis/redis.js';
import { Semaphore } from '../../src/shared/redis/semaphore.js';
import { sleep } from '../helpers/test-server.js';
import { testKeyPrefix } from '../helpers/test-server.js';
import { createClient } from 'redis';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
// a client on the test's keys, fresh for each test
let redis: RedisClient;

// --- CODE ---
beforeEach(async () => {
  redis = createClient({
    url: process.env.REDIS_URL as string,
    keyPrefix: testKeyPrefix(),
  });
  await redis.connect();
});

afterEach(async () => {
  await redis.close();
});

describe('locks and slots', () => {

  it('lets one holder at a time take a lock', async () => {
    const token = await acquireLock(redis, 'lock:a', 1000);

    expect(token).not.toBeNull();
    expect(await acquireLock(redis, 'lock:a', 1000)).toBeNull();

    // someone else's token releases nothing
    await releaseLock(redis, 'lock:a', 'not-mine');
    expect(await acquireLock(redis, 'lock:a', 1000)).toBeNull();

    await releaseLock(redis, 'lock:a', token as string);
    expect(await acquireLock(redis, 'lock:a', 1000)).not.toBeNull();
  });

  it('caps the slots and frees those of dead holders', async () => {
    const slots = new Semaphore(redis, 'slots', 2, 100);

    expect(await slots.acquire('a')).toBe(true);
    expect(await slots.acquire('b')).toBe(true);
    expect(await slots.acquire('c')).toBe(false);

    await slots.release('a');
    expect(await slots.acquire('c')).toBe(true);
    expect(await slots.count()).toBe(2);

    // b and c never give theirs back
    await sleep(150);
    expect(await slots.acquire('d')).toBe(true);
  });
});
