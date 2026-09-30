/**
 * What the browser remembers so a reload lands the player back in.
 */

// --- IMPORTS ---
import { readStored } from '../../shared/storage.ts';
import { removeStored } from '../../shared/storage.ts';
import { writeStored } from '../../shared/storage.ts';
import type { JoinResponse } from './room.types.ts';
import type { Session } from './room.types.ts';

// --- GLOBALS ---
const NAME_KEY = 'player-name';

// --- CODE ---
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
 * The name the player used last time.
 *
 * @returns {string} The name, empty when never set.
 */
export function readPlayerName(): string {
  return readStored<string>(NAME_KEY) ?? '';
}

/**
 * Remember the player's name for the next visit.
 *
 * @param {string} name The name.
 *
 * @returns {void}
 */
export function savePlayerName(name: string): void {
  writeStored(NAME_KEY, name);
}

/**
 * The player's identity in a room, if they joined it from this browser.
 *
 * @param {string} code The room code.
 *
 * @returns {Session | null} The identity, or null.
 */
export function readSession(code: string): Session | null {
  return readStored<Session>(sessionKey(code));
}

/**
 * Remember the identity a room handed out.
 *
 * @param {JoinResponse} response What creating or joining answered.
 *
 * @returns {Session} The saved identity.
 */
export function saveSession(response: JoinResponse): Session {

  const session = {
    playerId: response.player.id,
    token: response.player.token,
  };

  writeStored(sessionKey(response.room.code), session);

  return session;
}

/**
 * Forget the identity of a room: left it, or it is no longer valid.
 *
 * @param {string} code The room code.
 *
 * @returns {void}
 */
export function clearSession(code: string): void {
  removeStored(sessionKey(code));
}

/**
 * Storage key of a room's identity.
 *
 * @param {string} code The room code.
 *
 * @returns {string} The key.
 */
function sessionKey(code: string): string {
  return `session:${normalizeRoomCode(code)}`;
}
