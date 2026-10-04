/**
 * Challenge types.
 */

// --- CODE ---
/**
 * How hard a challenge is.
 */
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Every difficulty, from easiest to hardest.
 */
export const CHALLENGE_DIFFICULTIES: readonly ChallengeDifficulty[] = [
  'easy',
  'medium',
  'hard',
];

/**
 * An input and the output expected for it.
 */
export interface ChallengeCase {
  input: string;
  output: string;
}

/**
 * A coding challenge, including the hidden tests.
 */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  timeLimitSeconds: number;
  examples: ChallengeCase[];
  tests: ChallengeCase[];
}

/**
 * Challenge as sent to clients: no hidden tests.
 */
export interface PublicChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  timeLimitSeconds: number;
  examples: ChallengeCase[];
}
