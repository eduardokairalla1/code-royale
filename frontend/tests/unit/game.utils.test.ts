/**
 * Round helpers: clocks, status labels and lookups.
 */

// --- IMPORTS ---
import { describeStatus } from '../../src/modules/game/game.utils.ts';
import { findPlayer } from '../../src/modules/game/game.utils.ts';
import { findResult } from '../../src/modules/game/game.utils.ts';
import { formatClock } from '../../src/modules/game/game.utils.ts';
import type { Room } from '../../src/modules/room/room.types.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
const ROOM: Room = {
  code: 'ABCDE',
  status: 'PLAYING',
  hostId: 'ana',
  players: [{ id: 'ana', name: 'Ana', isHost: true, connected: true }],
  round: {
    challenge: {
      id: 'sum',
      title: 'Sum',
      description: 'Add them.',
      difficulty: 'easy',
      timeLimitSeconds: 60,
      examples: [],
    },
    startedAt: 0,
    endsAt: 60_000,
    serverNow: 0,
    results: [{
      playerId: 'ana',
      position: null,
      submittedAt: null,
      passed: null,
      total: null,
      percentage: null,
      autoSubmitted: false,
    }],
  },
};

// --- CODE ---
describe('formatClock', () => {

  it('shows minutes and padded seconds', () => {
    expect(formatClock(247_000)).toBe('4:07');
    expect(formatClock(60_000)).toBe('1:00');
  });

  it('rounds partial seconds up, so zero only shows at the end', () => {
    expect(formatClock(100)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });

  it('never goes negative', () => {
    expect(formatClock(-5000)).toBe('0:00');
  });
});

describe('describeStatus', () => {

  it('names every status in english', () => {
    expect(describeStatus('ACCEPTED')).toBe('Accepted');
    expect(describeStatus('WRONG_ANSWER')).toBe('Wrong answer');
    expect(describeStatus('TIME_LIMIT')).toBe('Time limit exceeded');
  });
});

describe('lookups', () => {

  it('finds the result and the player of an id', () => {
    expect(findResult(ROOM, 'ana')?.playerId).toBe('ana');
    expect(findPlayer(ROOM, 'ana')?.name).toBe('Ana');
  });

  it('answers null for someone not in the round or the room', () => {
    expect(findResult(ROOM, 'bia')).toBeNull();
    expect(findPlayer(ROOM, 'bia')).toBeNull();
    expect(findResult({ ...ROOM, round: null }, 'ana')).toBeNull();
  });
});
