/**
 * Room rules: create, join, look up rooms and track who is connected.
 */

// --- IMPORTS ---
import { generateRoomCode } from '../../shared/ids.js';
import { tokensMatch } from '../../shared/ids.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import type { Scheduler } from '../../shared/scheduler.js';
import { InvalidPlayerTokenError } from './room.errors.js';
import { NotHostError } from './room.errors.js';
import { RoomCodeGenerationError } from './room.errors.js';
import { RoomFullError } from './room.errors.js';
import { RoomNotFoundError } from './room.errors.js';
import { TooManyRoomsError } from './room.errors.js';
import type { RoomStore } from './room.store.js';
import type { Player } from './room.types.js';
import type { Room } from './room.types.js';
import { createPlayer } from './room.utils.js';
import { hasConnectedPlayers } from './room.utils.js';
import { normalizeRoomCode } from './room.utils.js';
import { pickNextHost } from './room.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- GLOBALS ---
const MAX_ROOM_CODE_ATTEMPTS = 10;

// scheduled tasks: a room with nobody connected, a player who dropped
const ROOM_TTL_TASK = 'room_ttl';
const PLAYER_GRACE_TASK = 'player_grace';

// why a player left: on their own, or never came back in time
type LeaveReason = 'leave' | 'grace_expired';

// why a room was dropped: its last player left, or nobody came back
type DeleteReason = 'empty' | 'expired';

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
  // how long a room with nobody connected is kept
  emptyRoomTtlMs: number;
  // how long a disconnected player has to come back before being removed
  reconnectGraceMs: number;
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
   * @param {Scheduler} scheduler Runs the delayed removals.
   * @param {RoomServiceOptions} options Settings and dependencies.
   */
  constructor(
    private readonly store: RoomStore,
    private readonly scheduler: Scheduler,
    private readonly options: RoomServiceOptions,
  ) {
    scheduler.handle(ROOM_TTL_TASK, (code) => this.expireRoom(code));

    scheduler.handle(PLAYER_GRACE_TASK, (key) => {
      const [code, playerId] = splitGraceKey(key);
      return this.removePlayer(code, playerId, 'grace_expired');
    });
  }

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
      round: null,
      playedChallengeIds: [],
      createdAt: Date.now(),
      version: 0,
    };

    // nobody connected yet: the room expires if the host never shows up
    await this.update(room);

    log(this.options.logger, 'info', Event.RoomCreated, {
      room_code: room.code,
      player_id: host.id,
      rooms: rooms + 1,
    });

    return { room, player: host };
  }

  /**
   * Add a new player to a room; mid game, they wait for the next round.
   *
   * @param {string} code The room code.
   * @param {string} name The player's name.
   *
   * @returns {Promise<JoinResult>} The room and the new player.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   * @throws {RoomFullError} When the room reached the player limit.
   */
  async join(code: string, name: string): Promise<JoinResult> {

    const room = await this.getOrThrow(code);

    // room reached the player limit
    if (room.players.size >= this.options.maxPlayersPerRoom) {
      throw new RoomFullError({
        code: room.code,
        players: room.players.size,
      });
    }

    const player = createPlayer(name);

    room.players.set(player.id, player);

    // the new player must connect within the grace period
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
   * @returns {Promise<Room | null>} The room, or null when missing.
   */
  async find(code: string): Promise<Room | null> {
    return this.store.get(normalizeRoomCode(code));
  }

  /**
   * Find a room by its code, failing when it does not exist.
   *
   * @param {string} code The room code, in any case.
   *
   * @returns {Promise<Room>} The room.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   */
  async getOrThrow(code: string): Promise<Room> {

    const room = await this.find(code);

    if (!room) {
      throw new RoomNotFoundError({ code: normalizeRoomCode(code) });
    }

    return room;
  }

  /**
   * Find a room on behalf of its host, for host-only actions.
   *
   * @param {string} code The room code, in any case.
   * @param {string} playerId Who is asking.
   *
   * @returns {Promise<Room>} The room.
   *
   * @throws {RoomNotFoundError} When the room does not exist.
   * @throws {NotHostError} When the player is not the host.
   */
  async getAsHost(code: string, playerId: string): Promise<Room> {

    const room = await this.getOrThrow(code);

    if (room.hostId !== playerId) {
      throw new NotHostError({ code: room.code, playerId });
    }

    return room;
  }

  /**
   * Save a changed room, re-apply the cleanup rules and notify listeners.
   *
   * @param {Room} room The changed room.
   *
   * @returns {Promise<void>}
   */
  async update(room: Room): Promise<void> {

    // clients keep the newest state they get
    room.version += 1;

    await this.store.save(room);

    await this.scheduleCleanup(room);
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
   * Remove a player, handing the host over or dropping the empty room.
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

    await this.scheduler.clear(PLAYER_GRACE_TASK, graceKey(code, playerId));
    room.players.delete(playerId);
    room.round?.results.delete(playerId);

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

    // host left: hand it over
    if (room.hostId === playerId) {
      this.handOverHost(room);
    }

    await this.update(room);
  }

  /**
   * Make the next player host, once the host is gone.
   *
   * @param {Room} room The room, without its host.
   *
   * @returns {void}
   */
  private handOverHost(room: Room): void {

    const previous = room.hostId;

    room.hostId = pickNextHost(room)?.id ?? room.hostId;

    log(this.options.logger, 'info', Event.HostChanged, {
      room_code: room.code,
      from: previous,
      to: room.hostId,
    });
  }

  /**
   * Delete a room whose ttl ran out, unless someone came back.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<void>}
   */
  private async expireRoom(code: string): Promise<void> {

    const room = await this.store.get(code);

    // someone reconnected in the meantime: keep it
    if (!room || hasConnectedPlayers(room)) {
      return;
    }

    await this.deleteRoom(room, 'expired');
  }

  /**
   * Delete a room and cancel all of its pending tasks.
   *
   * @param {Room} room The room to delete.
   * @param {DeleteReason} reason Why it goes.
   *
   * @returns {Promise<void>}
   */
  private async deleteRoom(room: Room, reason: DeleteReason): Promise<void> {

    await Promise.all([
      ...[...room.players.keys()].map((playerId) => {
        return this.scheduler.clear(
          PLAYER_GRACE_TASK,
          graceKey(room.code, playerId),
        );
      }),
      this.scheduler.clear(ROOM_TTL_TASK, room.code),
    ]);

    await this.store.delete(room.code);

    log(this.options.logger, 'info', Event.RoomDeleted, {
      room_code: room.code,
      reason,
      age_ms: Date.now() - room.createdAt,
      rounds: room.playedChallengeIds.length,
    });
  }

  /**
   * Expire empty rooms and drop disconnected players, not mid game.
   *
   * @param {Room} room The room that just changed.
   *
   * @returns {Promise<void>}
   */
  private async scheduleCleanup(room: Room): Promise<void> {

    const players = [...room.players.values()];

    // nobody connected: players wait together with the room
    if (!hasConnectedPlayers(room)) {
      await Promise.all([
        ...players.map((player) => {
          return this.scheduler.clear(
            PLAYER_GRACE_TASK,
            graceKey(room.code, player.id),
          );
        }),
        this.scheduler.start(
          ROOM_TTL_TASK,
          room.code,
          this.options.emptyRoomTtlMs,
        ),
      ]);

      return;
    }

    // someone connected: the room stays
    await Promise.all([
      this.scheduler.clear(ROOM_TTL_TASK, room.code),

      ...players.map((player) => {
        const key = graceKey(room.code, player.id);

        // connected, or mid game: nobody to remove
        if (player.socketId !== null || room.status === 'PLAYING') {
          return this.scheduler.clear(PLAYER_GRACE_TASK, key);
        }

        return this.scheduler.start(
          PLAYER_GRACE_TASK,
          key,
          this.options.reconnectGraceMs,
        );
      }),
    ]);
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

/**
 * The key of a player's grace period.
 *
 * @param {string} code The room code.
 * @param {string} playerId The player's id.
 *
 * @returns {string} The key, "code:playerId".
 */
function graceKey(code: string, playerId: string): string {
  return `${code}:${playerId}`;
}

/**
 * Split the key of a player's grace period.
 *
 * @param {string} key The key, "code:playerId".
 *
 * @returns {[string, string]} The room code and the player id.
 */
function splitGraceKey(key: string): [string, string] {

  const at = key.indexOf(':');

  return [key.slice(0, at), key.slice(at + 1)];
}
