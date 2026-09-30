/**
 * Challenge catalog, loaded from the json files in backend/challenges.
 */

// --- IMPORTS ---
import type { Challenge } from './challenge.types.js';
import { randomInt } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

// --- GLOBALS ---
// same depth from src/ and dist/, so it works in both
const CHALLENGES_DIR = new URL('../../../challenges/', import.meta.url);

const caseSchema = z.object({
  input: z.string(),
  output: z.string(),
});

const challengeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  timeLimitSeconds: z.number().int().positive(),
  examples: z.array(caseSchema).min(1),
  tests: z.array(caseSchema).min(1),
});

// --- CODE ---
/**
 * Holds every challenge in memory and picks one for each round.
 */
export class ChallengeService {

  /**
   * Create the service. Use ChallengeService.load() instead.
   *
   * @param {Challenge[]} challenges Every available challenge.
   */
  private constructor(private readonly challenges: Challenge[]) {}

  /**
   * Read and validate every challenge file, failing fast on boot.
   *
   * @param {URL} directory Where the json files are, backend/challenges by
   *                        default.
   *
   * @returns {ChallengeService} The loaded catalog.
   *
   * @throws {Error} When a file is invalid, an id repeats or none exist.
   */
  static load(directory: URL = CHALLENGES_DIR): ChallengeService {

    const files = readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .sort();

    const challenges: Challenge[] = [];

    for (const file of files) {
      const raw = readFileSync(new URL(file, directory), 'utf8');
      const result = challengeSchema.safeParse(JSON.parse(raw));

      // invalid file: stop and say which one
      if (!result.success) {
        throw new Error(
          `Invalid challenge "${file}":\n${z.prettifyError(result.error)}`,
        );
      }

      // ids must be unique, rooms remember them
      if (challenges.some((challenge) => challenge.id === result.data.id)) {
        throw new Error(`Duplicated challenge id "${result.data.id}"`);
      }

      challenges.push(result.data);
    }

    if (challenges.length === 0) {
      throw new Error('No challenges found');
    }

    return new ChallengeService(challenges);
  }

  /**
   * How many challenges there are.
   *
   * @returns {number} The number of challenges.
   */
  get count(): number {
    return this.challenges.length;
  }

  /**
   * Pick a random challenge, avoiding the ones already played.
   *
   * @param {string[]} playedIds Ids the room already played.
   *
   * @returns {Challenge} The picked challenge.
   */
  pickRandom(playedIds: string[]): Challenge {

    const unplayed = this.challenges.filter(
      (challenge) => !playedIds.includes(challenge.id),
    );

    // every challenge played: allow repeats
    const pool = unplayed.length > 0 ? unplayed : this.challenges;

    return pool[randomInt(pool.length)] as Challenge;
  }
}
