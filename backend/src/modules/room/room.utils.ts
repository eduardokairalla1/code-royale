/**
 * Room helpers: build players, public views and normalized codes.
 */

// --- IMPORTS ---
import { generatePlayerId } from '../../shared/ids.js';
import { generateToken } from '../../shared/ids.js';
import type { Player } from './room.types.js';

// --- CODE ---
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
