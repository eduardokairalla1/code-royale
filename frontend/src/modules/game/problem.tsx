/**
 * The challenge statement and its public examples.
 */

// --- IMPORTS ---
import { Paper } from '../../components/paper/paper.tsx';
import type { Challenge } from '../room/room.types.ts';
import type { ChallengeDifficulty } from '../room/room.types.ts';
import styles from './problem.module.css';

// --- GLOBALS ---
const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// --- CODE ---
/**
 * Props of the problem.
 */
export interface ProblemProps {
  challenge: Challenge;
}

/**
 * Render the statement and examples of a challenge.
 *
 * @param {ProblemProps} props The challenge.
 *
 * @returns {JSX.Element} The problem sheet.
 */
export function Problem({ challenge }: ProblemProps) {

  return (
    <Paper className={styles.problem}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{challenge.title}</h2>
        <span
          className={styles.difficulty}
          data-difficulty={challenge.difficulty}
        >
          {DIFFICULTY_LABELS[challenge.difficulty]}
        </span>
      </div>
      <p className={styles.description}>{challenge.description}</p>

      <h3 className={styles.subtitle}>Examples</h3>
      <ol className={styles.examples}>
        {challenge.examples.map((example, index) => (
          <li key={index} className={styles.example}>
            <div>
              <span className={styles.label}>Input</span>
              <pre className={styles.io}>{example.input}</pre>
            </div>
            <div>
              <span className={styles.label}>Output</span>
              <pre className={styles.io}>{example.output}</pre>
            </div>
          </li>
        ))}
      </ol>
    </Paper>
  );
}
