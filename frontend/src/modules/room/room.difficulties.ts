/**
 * Challenge difficulties: their order, names and the host's pick.
 */

// --- IMPORTS ---
import type { ChallengeDifficulty } from './room.types.ts';

// --- GLOBALS ---
// easiest first, the order the backend keeps them in
export const DIFFICULTIES: readonly ChallengeDifficulty[] = [
  'easy',
  'medium',
  'hard',
];

export const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// --- CODE ---
/**
 * Turn a difficulty on or off in the host's pick.
 *
 * @param {ChallengeDifficulty[]} picked The difficulties picked now.
 * @param {ChallengeDifficulty} difficulty The one clicked.
 *
 * @returns {ChallengeDifficulty[] | null} The new pick, easiest first; null
 *                                         when it would leave none.
 */
export function toggleDifficulty(
  picked: ChallengeDifficulty[],
  difficulty: ChallengeDifficulty,
): ChallengeDifficulty[] | null {

  const next = DIFFICULTIES.filter((item) => {
    return item === difficulty
      ? !picked.includes(item)
      : picked.includes(item);
  });

  // a round needs something to draw from
  return next.length > 0 ? next : null;
}
