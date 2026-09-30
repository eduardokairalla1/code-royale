/**
 * Validation of names and room codes typed by players.
 */

// --- IMPORTS ---
import { checkCode } from '../../src/modules/room/room.schemas.ts';
import { checkName } from '../../src/modules/room/room.schemas.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('checkName', () => {

  it('trims a valid name', () => {
    expect(checkName('  Lucas ')).toEqual({ value: 'Lucas', error: null });
  });

  it('refuses blank and long names, with a message', () => {
    expect(checkName('   ')).toEqual({
      value: null,
      error: 'Type your name.',
    });
    expect(checkName('x'.repeat(21)).error).toBe('At most 20 letters.');
  });
});

describe('checkCode', () => {

  it('trims a valid code and refuses a blank one', () => {
    expect(checkCode(' x7k2p ').value).toBe('x7k2p');
    expect(checkCode('').error).toBe('Type the room code.');
  });
});
