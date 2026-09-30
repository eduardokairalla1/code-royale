/**
 * Room helpers: room codes.
 */

// --- IMPORTS ---
import { normalizeRoomCode } from '../../src/modules/room/room.utils.js';
import { generateRoomCode } from '../../src/shared/ids.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('room codes', () => {

  it('are 5 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    }
  });

  it('match whatever case the player typed', () => {
    expect(normalizeRoomCode(' x7k2p ')).toBe('X7K2P');
  });
});
