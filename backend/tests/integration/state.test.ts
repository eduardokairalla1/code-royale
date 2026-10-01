/**
 * Redis building blocks: atomic room changes, timers, locks and slots.
 */

// --- IMPORTS ---
import { acquireLock } from '../../src/shared/redis/lock.js';
import { releaseLock } from '../../src/shared/redis/lock.js';
import type { RedisClient } from '../../src/shared/redis/redis.js';
import { Semaphore } from '../../src/shared/redis/semaphore.js';
import { Scheduler } from '../../src/shared/scheduler.js';
import { sleep } from '../helpers/test-server.js';
import { testKeyPrefix } from '../helpers/test-server.js';
import type { FastifyBaseLogger } from 'fastify';
import { createClient } from 'redis';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- GLOBALS ---
// a client on the test's keys, fresh for each test
let redis: RedisClient;

// whatever a test started, stopped after it
const schedulers: Scheduler[] = [];

// --- CODE ---
/**
 * A logger that records errors and ignores the rest.
 *
 * @returns {FastifyBaseLogger} The logger.
 */
function quietLogger(): FastifyBaseLogger {
  return { error: vi.fn() } as unknown as FastifyBaseLogger;
}

/**
 * A scheduler on the test's keys, polling fast.
 *
 * @returns {Scheduler} The running scheduler.
 */
function startScheduler(): Scheduler {

  const scheduler = new Scheduler(redis, {
    pollMs: 10,
    logger: quietLogger(),
  });

  schedulers.push(scheduler);

  return scheduler;
}

beforeEach(async () => {
  redis = createClient({
    url: process.env.REDIS_URL as string,
    keyPrefix: testKeyPrefix(),
  });
  await redis.connect();
});

afterEach(async () => {
  await Promise.all(schedulers.splice(0).map((s) => s.stop()));
  await redis.close();
});

describe('scheduler', () => {

  it('runs a task once, on one of the instances', async () => {
    const ran = vi.fn(async (_key: string) => {});
    const one = startScheduler();
    const two = startScheduler();

    one.handle('ping', ran);
    two.handle('ping', ran);
    one.run();
    two.run();

    await one.start('ping', 'a', 30);
    await sleep(150);

    expect(ran.mock.calls).toEqual([['a']]);
  });

  it('keeps the first deadline and cancels on clear', async () => {
    const ran = vi.fn(async (_key: string) => {});
    const scheduler = startScheduler();

    scheduler.handle('ping', ran);
    scheduler.run();

    await scheduler.start('ping', 'kept', 30);
    await scheduler.start('ping', 'kept', 10_000);
    await scheduler.start('ping', 'cleared', 30);
    await scheduler.clear('ping', 'cleared');
    await sleep(150);

    expect(ran.mock.calls).toEqual([['kept']]);
  });
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
