/**
 * Error classes and input validation.
 */

// --- IMPORTS ---
import { RoomNotFoundError } from '../../src/modules/room/room.errors.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import {
  RequestValidationError,
} from '../../src/shared/errors/request-validation-error.js';
import { parseInput } from '../../src/shared/validation.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { z } from 'zod';

// --- CODE ---
describe('AppError', () => {

  it('takes status, slug and message from its class', () => {
    const error = new RoomNotFoundError({ code: 'ABCDE' });

    expect(error.statusCode).toBe(404);
    expect(error.slug).toBe('room_not_found_error');
    expect(error.message).toBe('Room not found!');
    expect(error.details).toEqual({ code: 'ABCDE' });
  });

  it('defaults to a 500 logged as error', () => {
    const error = new AppError();

    expect([error.statusCode, error.logLevel]).toEqual([500, 'error']);
  });
});

describe('parseInput', () => {

  const schema = z.object({ name: z.string().trim().min(1) });

  it('returns the validated, transformed input', () => {
    expect(parseInput(schema, { name: '  Ana ' })).toEqual({ name: 'Ana' });
  });

  it('throws a RequestValidationError listing every bad field', () => {
    try {
      parseInput(schema, { name: 42 });
      expect.unreachable();

    // the list is what the client gets as message
    } catch (error) {
      expect(error).toBeInstanceOf(RequestValidationError);
      expect((error as RequestValidationError).responseMessage).toEqual([
        'name: Invalid input: expected string, received number',
      ]);
    }
  });
});
