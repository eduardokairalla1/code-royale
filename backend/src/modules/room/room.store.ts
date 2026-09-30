/**
 * Room storage contract.
 */

// --- IMPORTS ---
import type { Room } from './room.types.js';

// --- CODE ---
/**
 * Where rooms live: memory today, Redis with more than one server.
 */
export interface RoomStore {

  /**
   * Find a room by its code.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<Room | null>} The room, or null when missing.
   */
  get(code: string): Promise<Room | null>;

  /**
   * Create or replace a room.
   *
   * @param {Room} room The room to save.
   *
   * @returns {Promise<void>}
   */
  save(room: Room): Promise<void>;

  /**
   * Remove a room.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<void>}
   */
  delete(code: string): Promise<void>;

  /**
   * Count the rooms.
   *
   * @returns {Promise<number>} How many rooms exist.
   */
  count(): Promise<number>;
}
