/**
 * Rooms in Redis, changed atomically.
 */

// --- IMPORTS ---
import type { RedisClient } from '../../shared/redis/redis.js';
import type { ChallengeLookup } from './room.serializer.js';
import { parseRoom } from './room.serializer.js';
import { serializeRoom } from './room.serializer.js';
import type { Room } from './room.types.js';

// --- GLOBALS ---
// every room code, scored by when its key expires, to count them
const INDEX_KEY = 'rooms';

// a room nobody touched for this long is gone, whatever its state
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

// changes racing on one room: retried this many times before giving up
const MAX_ATTEMPTS = 50;

// write the room only if nobody changed it since it was read
const COMPARE_AND_SET_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[5])
return 1
`;

// --- CODE ---
/**
 * A room after a change, and what the change returned.
 */
export interface RoomChange<T> {
  room: Room;
  result: T;
  // false when the change left the room as it was: nothing was written
  changed: boolean;
}

/**
 * Where rooms live, shared by every instance of the backend.
 */
export class RoomStore {

  /**
   * Create the store.
   *
   * @param {RedisClient} redis The Redis client.
   * @param {ChallengeLookup} findChallenge Finds a round's challenge.
   */
  constructor(
    private readonly redis: RedisClient,
    private readonly findChallenge: ChallengeLookup,
  ) {}

  /**
   * Find a room by its code.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<Room | null>} The room, or null when missing.
   */
  async get(code: string): Promise<Room | null> {

    const json = await this.redis.get(roomKey(code));

    return json === null ? null : parseRoom(json, this.findChallenge);
  }

  /**
   * Store a new room, unless its code is taken.
   *
   * @param {Room} room The new room.
   *
   * @returns {Promise<boolean>} False when the code is already in use.
   */
  async create(room: Room): Promise<boolean> {

    const created = await this.redis.set(
      roomKey(room.code),
      serializeRoom(room),
      { NX: true, PX: ROOM_TTL_MS },
    );

    if (created === null) {
      return false;
    }

    await this.redis.zAdd(INDEX_KEY, {
      score: Date.now() + ROOM_TTL_MS,
      value: room.code,
    });

    return true;
  }

  /**
   * Change a room atomically: rerun on a fresh copy if it changed meanwhile.
   *
   * @param {string} code The room code.
   * @param {(room: Room) => T} change Changes the room; may run more than
   *                                   once, so it must not do anything else.
   *
   * @returns {Promise<RoomChange<T> | null>} The saved room and what the
   *                                          change returned, or null when
   *                                          the room does not exist.
   *
   * @throws {Error} Whatever the change throws; nothing is saved then.
   */
  async mutate<T>(
    code: string,
    change: (room: Room) => T,
  ): Promise<RoomChange<T> | null> {

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const before = await this.redis.get(roomKey(code));

      if (before === null) {
        return null;
      }

      const room = parseRoom(before, this.findChallenge);
      const result = change(room);

      // nothing to write
      if (serializeRoom(room) === before) {
        return { room, result, changed: false };
      }

      room.version += 1;

      const saved = await this.redis.eval(COMPARE_AND_SET_SCRIPT, {
        keys: [roomKey(code), INDEX_KEY],
        arguments: [
          before,
          serializeRoom(room),
          String(ROOM_TTL_MS),
          String(Date.now() + ROOM_TTL_MS),
          code,
        ],
      });

      if (saved === 1) {
        return { room, result, changed: true };
      }
    }

    throw new Error(`Room "${code}" kept changing, gave up`);
  }

  /**
   * Remove a room.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<void>}
   */
  async delete(code: string): Promise<void> {

    await this.redis.multi()
      .del(roomKey(code))
      .zRem(INDEX_KEY, code)
      .exec();
  }

  /**
   * Count the rooms.
   *
   * @returns {Promise<number>} How many rooms exist.
   */
  async count(): Promise<number> {

    // forget rooms whose key expired on its own
    await this.redis.zRemRangeByScore(INDEX_KEY, '-inf', Date.now());

    return this.redis.zCard(INDEX_KEY);
  }
}

/**
 * The key of a room.
 *
 * @param {string} code The room code.
 *
 * @returns {string} The key.
 */
function roomKey(code: string): string {
  return `room:${code}`;
}
