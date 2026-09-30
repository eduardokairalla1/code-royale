/**
 * Room http calls.
 */

// --- IMPORTS ---
import { request } from '../../shared/http.ts';
import type { JoinResponse } from './room.types.ts';

// --- CODE ---
/**
 * Create a room, with the caller as host.
 *
 * @param {string} name The host's name.
 *
 * @returns {Promise<JoinResponse>} The room and the host's identity.
 *
 * @throws {ApiError} When the backend refuses or cannot be reached.
 */
export function createRoom(name: string): Promise<JoinResponse> {
  return request<JoinResponse>('POST', '/rooms', { name });
}

/**
 * Join an existing room.
 *
 * @param {string} code The room code.
 * @param {string} name The player's name.
 *
 * @returns {Promise<JoinResponse>} The room and the player's identity.
 *
 * @throws {ApiError} When the room does not exist or is full.
 */
export function joinRoom(code: string, name: string): Promise<JoinResponse> {

  return request<JoinResponse>(
    'POST',
    `/rooms/${encodeURIComponent(code)}/join`,
    { name },
  );
}
