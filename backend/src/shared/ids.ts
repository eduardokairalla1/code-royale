/**
 * Random id, code and token generators, and the token check.
 */

// --- IMPORTS ---
import { createHash } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { randomInt } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';

// --- GLOBALS ---
// no 0/O or 1/I/L, so the code is easy to read out loud and type
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;

// --- CODE ---
/**
 * Generate a short random room code.
 *
 * @returns {string} The room code, e.g. "X7K2P".
 */
export function generateRoomCode(): string {

  let code = '';

  // pick each char at random from the alphabet
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
  }

  return code;
}

/**
 * Generate a unique player id.
 *
 * @returns {string} A random UUID.
 */
export function generatePlayerId(): string {
  return randomUUID();
}

/**
 * Generate a secret token.
 *
 * @returns {string} 32 random bytes, base64url encoded.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Compare two secret tokens in constant time.
 *
 * @param {string} expected The real token.
 * @param {string} given The token to check.
 *
 * @returns {boolean} Whether they are the same.
 */
export function tokensMatch(expected: string, given: string): boolean {

  // hashes have the same length whatever the tokens, as the check needs
  const digest = (token: string) => createHash('sha256').update(token).digest();

  return timingSafeEqual(digest(expected), digest(given));
}
