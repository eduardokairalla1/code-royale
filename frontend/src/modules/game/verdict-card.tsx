/**
 * How the one submission did against the hidden tests.
 */

// --- IMPORTS ---
import { Paper } from '../../components/paper/paper.tsx';
import type { Verdict } from './game.types.ts';
import { describeStatus } from './game.utils.ts';
import { Mark } from './mark.tsx';
import styles from './verdict-card.module.css';
import { motion } from 'motion/react';

// --- CODE ---
/**
 * Props of the verdict card.
 */
export interface VerdictCardProps {
  passed: number;
  total: number;
  percentage: number;
  // only known right after submitting, not after a reload
  status?: Verdict['status'] | null;
  compileError?: string | null;
  autoSubmitted?: boolean;
}

/**
 * Render the verdict of a submission.
 *
 * @param {VerdictCardProps} props The score and why it failed, if known.
 *
 * @returns {JSX.Element} The verdict card.
 */
export function VerdictCard({
  passed,
  total,
  percentage,
  status = null,
  compileError = null,
  autoSubmitted = false,
}: VerdictCardProps) {

  const accepted = passed === total && total > 0;

  return (
    <motion.div
      initial={{ scale: 0.6, rotate: 6, opacity: 0 }}
      animate={{ scale: 1, rotate: -1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
    >
      <Paper fill={accepted ? 'var(--crown)' : 'var(--paper-light)'}>
        <div className={styles.verdict}>
          <Mark passed={accepted} />
          <div className={styles.text}>
            <p className={styles.score}>
              {percentage}%
              <span className={styles.tests}>
                {passed}/{total} tests
              </span>
            </p>
            <p className={styles.status}>
              {accepted
                ? 'All tests passed!'
                : status
                  ? describeStatus(status)
                  : 'Submitted.'}
              {autoSubmitted && ' Submitted automatically when time ran out.'}
            </p>
          </div>
        </div>
        {compileError && <pre className={styles.compile}>{compileError}</pre>}
      </Paper>
    </motion.div>
  );
}
