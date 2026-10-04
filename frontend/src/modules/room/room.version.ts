/**
 * Room states in order: several servers may send them out of order.
 */

// --- IMPORTS ---
import type { Room } from './room.types.ts';

// --- CODE ---
/**
 * Pick the newer of two states of a room.
 *
 * @param {Room | null} current The state shown now, if any.
 * @param {Room} next The state just received.
 *
 * @returns {Room} The next state, unless it is older than the current.
 */
export function latestRoom(current: Room | null, next: Room): Room {

  // another room, or the first state: nothing to compare with
  if (!current || current.code !== next.code) {
    return next;
  }

  return next.version >= current.version ? next : current;
}
