/**
 * Challenge helpers.
 */

// --- IMPORTS ---
import type { Challenge } from './challenge.types.js';
import type { PublicChallenge } from './challenge.types.js';

// --- CODE ---
/**
 * Build the version of a challenge that is safe to send to clients.
 *
 * @param {Challenge} challenge The challenge.
 *
 * @returns {PublicChallenge} The challenge without its hidden tests.
 */
export function toPublicChallenge(challenge: Challenge): PublicChallenge {

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    timeLimitSeconds: challenge.timeLimitSeconds,
    examples: challenge.examples,
  };
}
