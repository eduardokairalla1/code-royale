/**
 * Round types.
 */

// --- IMPORTS ---
import type { Challenge } from '../challenge/challenge.types.js';
import type { PublicChallenge } from '../challenge/challenge.types.js';

// --- CODE ---
/**
 * The latest code a player has in the editor, synced while they type.
 */
export interface Draft {
  language: string;
  code: string;
}

/**
 * How a player did this round; null until their submission is judged.
 */
export interface PlayerResult {
  submittedAt: number | null;
  passed: number | null;
  total: number | null;
  autoSubmitted: boolean;
}

/**
 * One round of a room: a challenge against the clock.
 */
export interface Round {
  challenge: Challenge;
  startedAt: number;
  endsAt: number;
  results: Map<string, PlayerResult>;
  // never sent to clients: judged as is when time runs out
  drafts: Map<string, Draft>;
  submissions: Map<string, Draft>;
}

/**
 * A player's result as sent to clients.
 */
export interface PublicPlayerResult {
  playerId: string;
  position: number | null;
  submittedAt: number | null;
  passed: number | null;
  total: number | null;
  percentage: number | null;
  autoSubmitted: boolean;
}

/**
 * Round as sent to clients: no hidden tests, no drafts.
 */
export interface PublicRound {
  challenge: PublicChallenge;
  startedAt: number;
  endsAt: number;
  serverNow: number;
  results: PublicPlayerResult[];
}
