/**
 * Backend errors and the messages players read.
 */

// --- IMPORTS ---
import { ApiError } from '../../src/shared/errors.ts';
import { describeError } from '../../src/shared/errors.ts';
import { describeUnknownError } from '../../src/shared/errors.ts';
import { isErrorBody } from '../../src/shared/errors.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('errors', () => {

  it('translates known slugs and falls back for the rest', () => {
    expect(describeError('room_full_error')).toBe('The room is full.');
    expect(describeError('something_new')).toBe(
      'Something went wrong. Try again.',
    );
  });

  it('describes api errors by slug and anything else generically', () => {
    expect(describeUnknownError(new ApiError('room_not_found_error')))
      .toBe('Room not found.');
    expect(describeUnknownError(new Error('boom')))
      .toBe('Something went wrong. Try again.');
  });

  it('recognizes the backend error envelope', () => {
    expect(isErrorBody({ error: 'x', message: 'y' })).toBe(true);
    expect(isErrorBody({ ok: true })).toBe(false);
    expect(isErrorBody(null)).toBe(false);
  });
});
