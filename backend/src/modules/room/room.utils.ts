/**
 * Room helpers: build players, public views and normalized codes.
 */

// --- IMPORTS ---
import { generatePlayerId } from '../../shared/ids.js';
import { generateToken } from '../../shared/ids.js';
import type { Player } from './room.types.js';
import type { PublicRoom } from './room.types.js';
import type { Room } from './room.types.js';

// --- CODE ---
/**
 * Build the version of a room that is safe to send to clients.
 *
 * @param {Room} room The room.
 *
 * @returns {PublicRoom} The room without tokens.
 */
export function toPublicRoom(room: Room): PublicRoom {

  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostId,
    })),
  };
}

/**
 * Create a new player with a fresh id and token.
 *
 * @param {string} name The player's name.
 *
 * @returns {Player} The new player.
 */
export function createPlayer(name: string): Player {

  return {
    id: generatePlayerId(),
    name,
    token: generateToken(),
    joinedAt: Date.now(),
  };
}

/**
 * Normalize a room code, so "x7k2p" typed by hand still matches.
 *
 * @param {string} code The raw room code.
 *
 * @returns {string} The trimmed, uppercase code.
 */
export function normalizeRoomCode(code: string): string {

  return code.trim().toUpperCase();
}
