/**
 * Room states in order: late states are dropped.
 */

// --- IMPORTS ---
import type { Room } from '../../src/modules/room/room.types.ts';
import { latestRoom } from '../../src/modules/room/room.version.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * A lobby room at a given version.
 *
 * @param {string} code The room code.
 * @param {number} version The version.
 *
 * @returns {Room} The room.
 */
function room(code: string, version: number): Room {
  return {
    code,
    status: 'LOBBY',
    hostId: 'ana',
    players: [],
    round: null,
    difficulties: ['easy', 'medium', 'hard'],
    version,
  };
}

describe('latestRoom', () => {

  it('takes the first state and newer ones', () => {
    expect(latestRoom(null, room('A', 3))).toEqual(room('A', 3));
    expect(latestRoom(room('A', 3), room('A', 4))).toEqual(room('A', 4));
  });

  it('keeps the current state when an older one arrives late', () => {
    expect(latestRoom(room('A', 5), room('A', 4))).toEqual(room('A', 5));
  });

  it('takes the state of another room as is', () => {
    expect(latestRoom(room('A', 5), room('B', 1))).toEqual(room('B', 1));
  });
});
