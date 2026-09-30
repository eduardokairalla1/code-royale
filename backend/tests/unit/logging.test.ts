/**
 * Log helpers: how errors and wide events are logged.
 */

// --- IMPORTS ---
import { RoomNotFoundError } from '../../src/modules/room/room.errors.js';
import { describeError } from '../../src/shared/logging/error-fields.js';
import { WideEvent } from '../../src/shared/logging/wide-event.js';
import type { FastifyBaseLogger } from 'fastify';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- CODE ---
/**
 * A logger that only records calls.
 *
 * @returns {FastifyBaseLogger} The fake logger.
 */
function fakeLogger(): FastifyBaseLogger {

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return logger as unknown as FastifyBaseLogger;
}

describe('describeError', () => {

  it('takes the level and slug from app errors', () => {
    expect(describeError(new RoomNotFoundError({ code: 'ABCDE' }))).toEqual({
      level: 'warn',
      fields: { error: 'room_not_found_error', details: { code: 'ABCDE' } },
    });
  });

  it('logs fastify client errors as warnings', () => {
    const error = Object.assign(new Error('Bad json'), { statusCode: 400 });

    expect(describeError(error)).toEqual({
      level: 'warn',
      fields: { error: 'http_error', details: 'Bad json' },
    });
  });

  it('keeps the stack of anything else', () => {
    const error = new Error('boom');

    expect(describeError(error)).toEqual({
      level: 'error',
      fields: { error: 'internal_error', err: error },
    });
  });
});

describe('WideEvent', () => {

  it('logs once, with its fields, counters and duration', () => {
    const logger = fakeLogger();
    const event = new WideEvent().set({ room_code: 'ABCDE' });

    event.count('retries');
    event.count('retries');
    event.emit(logger, 'request');

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith({
      event: 'request',
      outcome: 'ok',
      room_code: 'ABCDE',
      retries: 2,
      duration_ms: expect.any(Number),
    }, 'request');
  });

  it('takes the level of the error it failed with', () => {
    const logger = fakeLogger();
    const event = new WideEvent('debug');

    event.fail(new RoomNotFoundError());
    event.emit(logger, 'request');

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'error',
        error: 'room_not_found_error',
      }),
      'request',
    );
  });
});
