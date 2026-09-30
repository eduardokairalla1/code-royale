/**
 * Room rules: create, join and look up rooms.
 */

// --- IMPORTS ---
import { generateRoomCode } from '../../shared/ids.js';
import { RoomCodeGenerationError } from './room.errors.js';
import { RoomFullError } from './room.errors.js';
import { RoomInGameError } from './room.errors.js';
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
 * Settings of the room service.
 */
export interface RoomServiceOptions {
  maxPlayersPerRoom: number;
}

/**
 * Room rules, shared by the http routes and the socket handlers.
 */
export class RoomService {

  /**
   * Create the service.
   *
   * @param {RoomStore} store Where rooms are kept.
   * @param {RoomServiceOptions} options Settings.
   */
  constructor(
    private readonly store: RoomStore,
    private readonly options: RoomServiceOptions,
  ) {}

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
   * Add a new player to an existing room.
   *
   * @param {string} code The room code.
   * @param {string} name The player's name.
   *
   * @returns {Promise<JoinResult>} The room and the new player.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   * @throws {RoomInGameError} When a game is running.
   * @throws {RoomFullError} When the room reached the player limit.
   */
  async join(code: string, name: string): Promise<JoinResult> {

    const room = await this.getOrThrow(code);

    // no joining mid game
    if (room.status === 'PLAYING') {
      throw new RoomInGameError({ code: room.code });
    }

    // room reached the player limit
    if (room.players.size >= this.options.maxPlayersPerRoom) {
      throw new RoomFullError({
        code: room.code,
        players: room.players.size,
      });
    }

    const player = createPlayer(name);

    room.players.set(player.id, player);

    await this.store.save(room);

    return { room, player };
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
