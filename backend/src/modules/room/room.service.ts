/**
 * Room rules: create, join and look up rooms.
 */

// --- IMPORTS ---
import { generateRoomCode } from '../../shared/ids.js';
import { RoomCodeGenerationError } from './room.errors.js';
import { RoomNotFoundError } from './room.errors.js';
import type { RoomStore } from './room.store.js';
import type { Player } from './room.types.js';
import type { Room } from './room.types.js';
import { createPlayer } from './room.utils.js';
import { normalizeRoomCode } from './room.utils.js';

// --- GLOBALS ---
const MAX_ROOM_CODE_ATTEMPTS = 10;

// --- CODE ---
/**
 * A room together with the player that just entered it.
 */
export interface JoinResult {
  room: Room;
  player: Player;
}

/**
 * Room rules, shared by the http routes and the socket handlers.
 */
export class RoomService {

  /**
   * Create the service.
   *
   * @param {RoomStore} store Where rooms are kept.
   */
  constructor(private readonly store: RoomStore) {}

  /**
   * Create a room with the given player as host.
   *
   * @param {string} hostName The host's name.
   *
   * @returns {Promise<JoinResult>} The new room and its host.
   */
  async create(hostName: string): Promise<JoinResult> {

    const host = createPlayer(hostName);

    const room: Room = {
      code: await this.generateUniqueCode(),
      hostId: host.id,
      status: 'LOBBY',
      players: new Map([[host.id, host]]),
      createdAt: Date.now(),
    };

    await this.store.save(room);

    return { room, player: host };
  }

  /**
   * Find a room by its code.
   *
   * @param {string} code The room code, in any case.
   *
   * @returns {Promise<Room>} The room.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   */
  async getOrThrow(code: string): Promise<Room> {

    const normalizedCode = normalizeRoomCode(code);
    const room = await this.store.get(normalizedCode);

    if (!room) {
      throw new RoomNotFoundError({ code: normalizedCode });
    }

    return room;
  }

  /**
   * Generate a room code that is not in use.
   *
   * @returns {Promise<string>} A free room code.
   *
   * @throws {RoomCodeGenerationError} When every attempt collided.
   */
  private async generateUniqueCode(): Promise<string> {

    // retry on collision
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode();

      if (!(await this.store.get(code))) {
        return code;
      }
    }

    throw new RoomCodeGenerationError({
      attempts: MAX_ROOM_CODE_ATTEMPTS,
    });
  }
}
