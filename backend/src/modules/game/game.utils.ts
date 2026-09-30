/**
 * Round helpers.
 */

// --- IMPORTS ---
import type { Challenge } from '../challenge/challenge.types.js';
import { toPublicChallenge } from '../challenge/challenge.utils.js';
import type { PlayerResult } from './game.types.js';
import type { PublicPlayerResult } from './game.types.js';
import type { PublicRound } from './game.types.js';
import type { Round } from './game.types.js';

// --- CODE ---
/**
 * Start a round for the given players.
 *
 * @param {Challenge} challenge The challenge of the round.
 * @param {string[]} playerIds Who takes part.
 *
 * @returns {Round} The new round, ending after the challenge time limit.
 */
export function createRound(challenge: Challenge, playerIds: string[]): Round {

  const startedAt = Date.now();

  return {
    challenge,
    startedAt,
    endsAt: startedAt + challenge.timeLimitSeconds * 1000,
    results: new Map(
      playerIds.map((playerId) => [
        playerId,
        { submittedAt: null, passed: null, total: null, autoSubmitted: false },
      ]),
    ),
  };
}

/**
 * Build the version of a round that is safe to send to clients.
 *
 * @param {Round} round The round.
 *
 * @returns {PublicRound} The round, ranked, without tests or drafts.
 */
export function toPublicRound(round: Round): PublicRound {

  return {
    challenge: toPublicChallenge(round.challenge),
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    serverNow: Date.now(),
    results: rankResults(round.results),
  };
}

/**
 * Rank by percentage then submit time; judging next, no submission last.
 *
 * @param {Map<string, PlayerResult>} results The results by player id.
 *
 * @returns {PublicPlayerResult[]} The ranked public results.
 */
function rankResults(results: Map<string, PlayerResult>): PublicPlayerResult[] {

  const ranked = [...results.entries()]
    .map(([playerId, result]) => toPublicResult(playerId, result))
    .sort(compareResults);

  // positions only for those who submitted
  let position = 0;

  return ranked.map((result) => ({
    ...result,
    position: result.submittedAt === null ? null : ++position,
  }));
}

/**
 * Build a public result, without its position yet.
 *
 * @param {string} playerId The player's id.
 * @param {PlayerResult} result The player's result.
 *
 * @returns {PublicPlayerResult} The public result, position still null.
 */
function toPublicResult(
  playerId: string,
  result: PlayerResult,
): PublicPlayerResult {

  // judged: turn passed/total into a percentage
  const percentage = result.passed !== null && result.total
    ? Math.round((result.passed / result.total) * 100)
    : null;

  return {
    playerId,
    position: null,
    submittedAt: result.submittedAt,
    passed: result.passed,
    total: result.total,
    percentage,
    autoSubmitted: result.autoSubmitted,
  };
}

/**
 * Order two public results, best first.
 *
 * @param {PublicPlayerResult} a One result.
 * @param {PublicPlayerResult} b Another result.
 *
 * @returns {number} Negative when a ranks above b.
 */
function compareResults(a: PublicPlayerResult, b: PublicPlayerResult): number {

  // submitted before not submitted
  if ((a.submittedAt === null) !== (b.submittedAt === null)) {
    return a.submittedAt === null ? 1 : -1;
  }

  // judged before still being judged
  if ((a.percentage === null) !== (b.percentage === null)) {
    return a.percentage === null ? 1 : -1;
  }

  // higher percentage first
  if (a.percentage !== b.percentage) {
    return (b.percentage ?? 0) - (a.percentage ?? 0);
  }

  // same percentage: whoever submitted first
  return (a.submittedAt ?? 0) - (b.submittedAt ?? 0);
}
