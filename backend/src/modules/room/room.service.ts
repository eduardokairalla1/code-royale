/**
 * Room rules: create, join, look up rooms and track who is connected.
 */

// --- IMPORTS ---
import { generateRoomCode } from '../../shared/ids.js';
import { tokensMatch } from '../../shared/ids.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { InvalidPlayerTokenError } from './room.errors.js';
import { RoomCodeGenerationError } from './room.errors.js';
import { RoomFullError } from './room.errors.js';
import { RoomInGameError } from './room.errors.js';
import { RoomNotFoundError } from './room.errors.js';
import { TooManyRoomsError } from './room.errors.js';
import type { RoomStore } from './room.store.js';
import type { Player } from './room.types.js';
import type { Room } from './room.types.js';
import { createPlayer } from './room.utils.js';
import { normalizeRoomCode } from './room.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- GLOBALS ---
const MAX_ROOM_CODE_ATTEMPTS = 10;

// why a player left: on their own
type LeaveReason = 'leave';

// why a room was dropped: its last player left
type DeleteReason = 'empty';

// --- CODE ---
/**
 * A room together with the player that just entered it.
 */
export interface JoinResult {
  room: Room;
  player: Player;
}

/**
 * Settings and dependencies of the room service.
 */
export interface RoomServiceOptions {
  maxPlayersPerRoom: number;
  // rooms held at once, so creating them cannot eat the memory
  maxRooms: number;
  logger: FastifyBaseLogger;
}

/**
 * Called whenever a room's public state changes.
 */
export type RoomChangeListener = (room: Room) => void;

/**
 * Room rules, shared by the http routes and the socket handlers.
 */
export class RoomService {
  private readonly listeners: RoomChangeListener[] = [];

  /**
   * Create the service.
   *
   * @param {RoomStore} store Where rooms are kept.
   * @param {RoomServiceOptions} options Settings and dependencies.
   */
  constructor(
    private readonly store: RoomStore,
    private readonly options: RoomServiceOptions,
  ) {}

  /**
   * Subscribe to room state changes.
   *
   * @param {RoomChangeListener} listener Called with the changed room.
   *
   * @returns {void}
   */
  onRoomChanged(listener: RoomChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Create a room with the given player as host.
   *
   * @param {string} hostName The host's name.
   *
   * @returns {Promise<JoinResult>} The new room and its host.
   *
   * @throws {TooManyRoomsError} When the server holds as many as it may.
   */
  async create(hostName: string): Promise<JoinResult> {

    const rooms = await this.store.count();

    if (rooms >= this.options.maxRooms) {
      throw new TooManyRoomsError({ rooms });
    }

    const host = createPlayer(hostName);

    const room: Room = {
      code: await this.generateUniqueCode(),
      hostId: host.id,
      status: 'LOBBY',
      players: new Map([[host.id, host]]),
      createdAt: Date.now(),
    };

    await this.update(room);

    log(this.options.logger, 'info', Event.RoomCreated, {
      room_code: room.code,
      player_id: host.id,
      rooms: rooms + 1,
    });

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

    await this.update(room);

    log(this.options.logger, 'info', Event.PlayerJoined, {
      room_code: room.code,
      player_id: player.id,
      players: room.players.size,
      status: room.status,
    });

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
   * Save a changed room and notify listeners.
   *
   * @param {Room} room The changed room.
   *
   * @returns {Promise<void>}
   */
  async update(room: Room): Promise<void> {

    await this.store.save(room);

    this.notify(room);
  }

  /**
   * Find the player of a room that owns the given token.
   *
   * @param {string} code The room code, in any case.
   * @param {string} token The player's secret token.
   *
   * @returns {Promise<JoinResult>} The room and the token's owner.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   * @throws {InvalidPlayerTokenError} When no player owns the token.
   */
  async authenticate(code: string, token: string): Promise<JoinResult> {

    const room = await this.getOrThrow(code);

    const player = [...room.players.values()].find(
      (candidate) => tokensMatch(candidate.token, token),
    );

    if (!player) {
      throw new InvalidPlayerTokenError({ code: room.code });
    }

    return { room, player };
  }

  /**
   * Bind a socket to a player, replacing the socket they had before.
   *
   * @param {string} code The room code.
   * @param {string} playerId The player's id.
   * @param {string} socketId The new socket's id.
   *
   * @returns {Promise<string | null>} The replaced socket id, if any.
   *
   * @throws {InvalidPlayerTokenError} When the player is no longer there.
   */
  async connect(
    code: string,
    playerId: string,
    socketId: string,
  ): Promise<string | null> {

    const room = await this.store.get(code);
    const player = room?.players.get(playerId);

    // removed between authentication and connection
    if (!room || !player) {
      throw new InvalidPlayerTokenError({ code, playerId });
    }

    const replacedSocketId = player.socketId;

    player.socketId = socketId;

    await this.update(room);

    return replacedSocketId;
  }

  /**
   * Mark a player as disconnected, starting their grace period.
   *
   * @param {string} code The room code.
   * @param {string} playerId The player's id.
   * @param {string} socketId The socket that disconnected.
   *
   * @returns {Promise<void>}
   */
  async disconnect(
    code: string,
    playerId: string,
    socketId: string,
  ): Promise<void> {

    const room = await this.store.get(code);
    const player = room?.players.get(playerId);

    // stale socket: the player left or is already on another socket
    if (!room || !player || player.socketId !== socketId) {
      return;
    }

    player.socketId = null;

    await this.update(room);
  }

  /**
   * Remove a player from a room right away.
   *
   * @param {string} code The room code.
   * @param {string} playerId The player's id.
   *
   * @returns {Promise<void>}
   */
  async leave(code: string, playerId: string): Promise<void> {
    await this.removePlayer(code, playerId, 'leave');
  }

  /**
   * Remove a player, dropping the room once it is empty.
   *
   * @param {string} code The room code.
   * @param {string} playerId The player's id.
   * @param {LeaveReason} reason Why they are removed.
   *
   * @returns {Promise<void>}
   */
  private async removePlayer(
    code: string,
    playerId: string,
    reason: LeaveReason,
  ): Promise<void> {

    const room = await this.store.get(code);

    // already gone
    if (!room || !room.players.has(playerId)) {
      return;
    }

    room.players.delete(playerId);

    log(this.options.logger, 'info', Event.PlayerLeft, {
      room_code: room.code,
      player_id: playerId,
      reason,
      players: room.players.size,
    });

    // last player gone: drop the room
    if (room.players.size === 0) {
      await this.deleteRoom(room, 'empty');
      return;
    }

    await this.update(room);
  }

  /**
   * Delete a room.
   *
   * @param {Room} room The room to delete.
   * @param {DeleteReason} reason Why it goes.
   *
   * @returns {Promise<void>}
   */
  private async deleteRoom(room: Room, reason: DeleteReason): Promise<void> {

    await this.store.delete(room.code);

    log(this.options.logger, 'info', Event.RoomDeleted, {
      room_code: room.code,
      reason,
      age_ms: Date.now() - room.createdAt,
    });
  }

  /**
   * Tell every listener that a room changed.
   *
   * @param {Room} room The changed room.
   *
   * @returns {void}
   */
  private notify(room: Room): void {
    this.listeners.forEach((listener) => listener(room));
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
