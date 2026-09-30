/**
 * Rounds: creation, ranking and summary.
 */

// --- IMPORTS ---
import type { Challenge } from '../../src/modules/challenge/challenge.types.js';
import type { PlayerResult } from '../../src/modules/game/game.types.js';
import { createRound } from '../../src/modules/game/game.utils.js';
import { roundSummary } from '../../src/modules/game/game.utils.js';
import { toPublicRound } from '../../src/modules/game/game.utils.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
const CHALLENGE: Challenge = {
  id: 'sum',
  title: 'Sum',
  description: 'Add them up.',
  difficulty: 'easy',
  timeLimitSeconds: 60,
  examples: [{ input: '1 2', output: '3' }],
  tests: [{ input: 'SECRET', output: '0' }],
};

// --- CODE ---
/**
 * Build a result.
 *
 * @param {Partial<PlayerResult>} fields What differs from "not submitted".
 *
 * @returns {PlayerResult} The result.
 */
function result(fields: Partial<PlayerResult>): PlayerResult {
  return {
    submittedAt: null,
    passed: null,
    total: null,
    autoSubmitted: false,
    ...fields,
  };
}

describe('createRound', () => {

  it('lasts the challenge time limit and includes every player', () => {
    const round = createRound(CHALLENGE, ['a', 'b']);

    expect(round.endsAt - round.startedAt).toBe(60_000);
    expect([...round.results.keys()]).toEqual(['a', 'b']);
  });
});

describe('toPublicRound', () => {

  it('never exposes the hidden tests', () => {
    const round = createRound(CHALLENGE, ['a']);

    const json = JSON.stringify(toPublicRound(round));

    expect(json).not.toContain('SECRET');
  });

  it('ranks full solves by time, then partials, then not submitted', () => {
    const round = createRound(CHALLENGE, []);

    round.results.set('late-full', result({
      submittedAt: 300, passed: 4, total: 4,
    }));
    round.results.set('nothing', result({}));
    round.results.set('partial', result({
      submittedAt: 100, passed: 2, total: 4,
    }));
    round.results.set('early-full', result({
      submittedAt: 200, passed: 4, total: 4,
    }));
    round.results.set('judging', result({ submittedAt: 50 }));

    const ranked = toPublicRound(round).results;

    expect(ranked.map((r) => r.playerId)).toEqual([
      'early-full', 'late-full', 'partial', 'judging', 'nothing',
    ]);
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3, 4, null]);
    expect(ranked.map((r) => r.percentage)).toEqual([100, 100, 50, null, null]);
  });

  it('breaks equal percentages by who submitted first', () => {
    const round = createRound(CHALLENGE, []);

    round.results.set('second', result({
      submittedAt: 20, passed: 1, total: 4,
    }));
    round.results.set('first', result({
      submittedAt: 10, passed: 1, total: 4,
    }));

    const ranked = toPublicRound(round).results.map((r) => r.playerId);

    expect(ranked).toEqual(['first', 'second']);
  });
});

describe('roundSummary', () => {

  it('counts who submitted, by hand or at time out, and who solved it', () => {
    const round = createRound(CHALLENGE, ['a', 'b', 'c', 'd']);

    round.results.set('a', result({ submittedAt: 1, passed: 1, total: 1 }));
    round.results.set('b', result({ submittedAt: 2, passed: 0, total: 1 }));
    round.results.set('c', result({
      submittedAt: 3,
      passed: 1,
      total: 1,
      autoSubmitted: true,
    }));

    expect(roundSummary(round)).toMatchObject({
      challenge_id: 'sum',
      players: 4,
      submitted: 2,
      auto_submitted: 1,
      missing: 1,
      solved: 2,
    });
  });
});
