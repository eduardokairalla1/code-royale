/**
 * In-memory room store.
 */

// --- IMPORTS ---
import type { RoomStore } from './room.store.js';
import type { Room } from './room.types.js';

// --- CODE ---
/**
 * Keeps rooms in a Map. Rooms are lost when the process restarts.
 */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  /**
   * Find a room by its code.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<Room | null>} The room, or null when missing.
   */
  async get(code: string): Promise<Room | null> {
    return this.rooms.get(code) ?? null;
  }

  /**
   * Create or replace a room.
   *
   * @param {Room} room The room to save.
   *
   * @returns {Promise<void>}
   */
  async save(room: Room): Promise<void> {
    this.rooms.set(room.code, room);
  }

  /**
   * Remove a room.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<void>}
   */
  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }

  /**
   * Count the rooms.
   *
   * @returns {Promise<number>} How many rooms exist.
   */
  async count(): Promise<number> {
    return this.rooms.size;
  }
}
