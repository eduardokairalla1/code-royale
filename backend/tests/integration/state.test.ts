/**
 * Redis building blocks: atomic room changes, timers, locks and slots.
 */

// --- IMPORTS ---
import {
  ChallengeService,
} from '../../src/modules/challenge/challenge.service.js';
import type {
  Challenge,
} from '../../src/modules/challenge/challenge.types.js';
import { RoomStore } from '../../src/modules/room/room.store.js';
import type { Room } from '../../src/modules/room/room.types.js';
import { createPlayer } from '../../src/modules/room/room.utils.js';
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
const FIXTURES = new URL('../fixtures/challenges/', import.meta.url);

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
 * @param {number} leaseMs How long a claimed task may run.
 *
 * @returns {Scheduler} The running scheduler.
 */
function startScheduler(leaseMs = 60_000): Scheduler {

  const scheduler = new Scheduler(redis, {
    pollMs: 10,
    leaseMs,
    logger: quietLogger(),
  });

  schedulers.push(scheduler);

  return scheduler;
}

/**
 * A lobby room hosted by Ana.
 *
 * @param {string} code The room code.
 *
 * @returns {Room} The room.
 */
function lobby(code: string): Room {

  const host = createPlayer('Ana');

  return {
    code,
    hostId: host.id,
    status: 'LOBBY',
    players: new Map([[host.id, host]]),
    round: null,
    playedChallengeIds: [],
    difficulties: ['easy', 'medium', 'hard'],
    createdAt: Date.now(),
    version: 0,
  };
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

describe('room store', () => {

  const challenges = ChallengeService.load(FIXTURES);

  it('keeps every change made at once to the same room', async () => {
    const store = new RoomStore(redis, (id) => challenges.find(id));

    await store.create(lobby('AAAAA'));

    await Promise.all(Array.from({ length: 30 }, (_, index) => {
      return store.mutate('AAAAA', (room) => {
        room.playedChallengeIds.push(String(index));
      });
    }));

    const room = await store.get('AAAAA');

    expect(room?.playedChallengeIds).toHaveLength(30);
    expect(room?.version).toBe(30);
  });

  it('refuses a code in use and writes nothing for no change', async () => {
    const store = new RoomStore(redis, (id) => challenges.find(id));

    expect(await store.create(lobby('BBBBB'))).toBe(true);
    expect(await store.create(lobby('BBBBB'))).toBe(false);

    const change = await store.mutate('BBBBB', () => 'same');

    expect(change).toMatchObject({ result: 'same', changed: false });
    expect(await store.count()).toBe(1);

    await store.delete('BBBBB');

    expect(await store.mutate('BBBBB', () => 'gone')).toBeNull();
    expect(await store.count()).toBe(0);
  });

  it('keeps a round across the round trip, its challenge by id', async () => {
    const store = new RoomStore(redis, (id) => challenges.find(id));
    const room = lobby('CCCCC');
    const challenge = challenges.find('alpha') as Challenge;
    const hostId = room.hostId;

    room.status = 'PLAYING';
    room.round = {
      challenge,
      startedAt: 1,
      endsAt: 2,
      results: new Map([[hostId, {
        submittedAt: 1,
        passed: 1,
        total: 2,
        autoSubmitted: false,
      }]]),
      submissions: new Map([[hostId, { language: 'python', code: 'x' }]]),
    };

    await store.create(room);

    expect(await store.get('CCCCC')).toEqual(room);
  });

  it('lets rooms stored before the filter draw any difficulty', async () => {
    const store = new RoomStore(redis, (id) => challenges.find(id));
    const { difficulties: _, ...old } = lobby('DDDDD');

    await redis.set('room:DDDDD', JSON.stringify({ ...old, players: [] }));

    expect((await store.get('DDDDD'))?.difficulties)
      .toEqual(['easy', 'medium', 'hard']);
  });
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

  it('runs a task again once a dead instance lets its lease go', async () => {
    const one = startScheduler(100);

    // the first instance claims it and never finishes
    one.handle('ping', () => new Promise(() => {}));
    one.run();
    await one.start('ping', 'a', 0);
    await sleep(50);
    schedulers.splice(schedulers.indexOf(one), 1);
    void one.stop();

    const ran = vi.fn(async (_key: string) => {});
    const two = startScheduler(100);

    two.handle('ping', ran);
    two.run();
    await sleep(250);

    expect(ran.mock.calls).toEqual([['a']]);
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
