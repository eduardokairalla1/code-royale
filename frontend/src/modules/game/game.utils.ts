/**
 * Round helpers: clocks, labels and lookups.
 */

// --- IMPORTS ---
import type { Player } from '../room/room.types.ts';
import type { PlayerResult } from '../room/room.types.ts';
import type { Room } from '../room/room.types.ts';
import type { TestStatus } from './game.types.ts';
import type { Verdict } from './game.types.ts';

// --- GLOBALS ---
// what each status means, in the player's words
const STATUS_LABELS: Record<TestStatus | 'ACCEPTED', string> = {
  OK: 'Passed',
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  COMPILE_ERROR: 'Compile error',
  RUNTIME_ERROR: 'Runtime error',
  TIME_LIMIT: 'Time limit exceeded',
  OUTPUT_LIMIT: 'Output too large',
};

// --- CODE ---
/**
 * Describe a test or verdict status.
 *
 * @param {TestStatus | Verdict['status']} status The status.
 *
 * @returns {string} Its label.
 */
export function describeStatus(status: TestStatus | Verdict['status']): string {
  return STATUS_LABELS[status];
}

/**
 * Format a duration as a clock.
 *
 * @param {number} ms The duration, negative counts as zero.
 *
 * @returns {string} The clock, e.g. "4:07".
 */
export function formatClock(ms: number): string {

  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Find the result of a player in the current round.
 *
 * @param {Room} room The room.
 * @param {string} playerId The player's id.
 *
 * @returns {PlayerResult | null} The result, null when not in the round.
 */
export function findResult(room: Room, playerId: string): PlayerResult | null {

  return room.round?.results.find((result) => {
    return result.playerId === playerId;
  }) ?? null;
}

/**
 * Find a player of the room by id.
 *
 * @param {Room} room The room.
 * @param {string} playerId The player's id.
 *
 * @returns {Player | null} The player, null when they left.
 */
export function findPlayer(room: Room, playerId: string): Player | null {
  return room.players.find((player) => player.id === playerId) ?? null;
}
