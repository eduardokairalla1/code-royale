/**
 * Redis connections: a lost Redis is logged, never a crash.
 */

// --- IMPORTS ---
import { RedisConnections } from '../../src/shared/redis/redis.js';
import type { FastifyBaseLogger } from 'fastify';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- CODE ---
describe('RedisConnections', () => {

  it('logs a Redis it cannot reach once per client', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    const redis = new RedisConnections({
      // nothing listens there
      url: 'redis://127.0.0.1:1',
      keyPrefix: 'test:',
      logger: logger as unknown as FastifyBaseLogger,
    });

    const connecting = redis.connect().catch(() => {});

    // several reconnect attempts, still one line per client
    await sleep(500);

    const events = logger.error.mock.calls.map(([fields]) => fields);

    expect(events.map((fields) => fields.client).sort())
      .toEqual(['client', 'publisher', 'subscriber']);
    expect(events.every((fields) => fields.event === 'redis_down'))
      .toBe(true);

    for (const client of [redis.client, redis.publisher, redis.subscriber]) {
      client.destroy();
    }

    await connecting;
  });
});
