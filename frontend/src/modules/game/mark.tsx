/**
 * A check or a cross, drawn stroke by stroke like a teacher's marker.
 */

// --- IMPORTS ---
import styles from './mark.module.css';
import { motion } from 'motion/react';

// --- CODE ---
/**
 * A check or a cross, drawn stroke by stroke.
 *
 * @param {object} props Whether it passed.
 * @param {boolean} props.passed True for a check, false for a cross.
 *
 * @returns {JSX.Element} The mark.
 */
export function Mark({ passed }: { passed: boolean }) {

  const paths = passed
    ? ['M4 13 L10 19 L20 5']
    : ['M5 5 L19 19', 'M19 5 L5 19'];

  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.mark}
      data-passed={passed}
      aria-label={passed ? 'Passed' : 'Failed'}
    >
      {paths.map((d, index) => (
        <motion.path
          key={d}
          d={d}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, delay: 0.2 + index * 0.2 }}
        />
      ))}
    </svg>
  );
}
