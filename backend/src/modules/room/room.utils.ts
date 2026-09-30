/**
 * Room helpers: build players, public views and normalized codes.
 */

// --- IMPORTS ---
import { generatePlayerId } from '../../shared/ids.js';
import { generateToken } from '../../shared/ids.js';
import { toPublicRound } from '../game/game.utils.js';
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
      connected: player.socketId !== null,
    })),
    round: room.round ? toPublicRound(room.round) : null,
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
    socketId: null,
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

/**
 * Tell whether any player of a room has a live socket.
 *
 * @param {Room} room The room.
 *
 * @returns {boolean} True when at least one player is connected.
 */
export function hasConnectedPlayers(room: Room): boolean {
  return [...room.players.values()].some((player) => player.socketId !== null);
}

/**
 * Pick the next host: the oldest connected player, else the oldest.
 *
 * @param {Room} room The room, already without the old host.
 *
 * @returns {Player | undefined} The next host, undefined for an empty room.
 */
export function pickNextHost(room: Room): Player | undefined {

  const players = [...room.players.values()];

  // map keeps join order, so the first match is the oldest
  return players.find((player) => player.socketId !== null) ?? players[0];
}
