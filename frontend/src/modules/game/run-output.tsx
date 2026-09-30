/**
 * What running the public examples printed, one card per example.
 */

// --- IMPORTS ---
import type { ExampleResult } from './game.types.ts';
import { describeStatus } from './game.utils.ts';
import { Mark } from './mark.tsx';
import styles from './run-output.module.css';
import { motion } from 'motion/react';

// --- CODE ---
/**
 * Props of the run output.
 */
export interface RunOutputProps {
  results: ExampleResult[];
}

/**
 * Render the outcome of each example.
 *
 * @param {RunOutputProps} props The results of the run.
 *
 * @returns {JSX.Element} The output cards.
 */
export function RunOutput({ results }: RunOutputProps) {

  const passed = results.filter((result) => result.passed).length;

  return (
    <section className={styles.output} aria-label="Examples output">
      <p className={styles.summary}>
        {passed} of {results.length} examples passed
      </p>

      <ol className={styles.list}>
        {results.map((result, index) => (
          <motion.li
            key={index}
            className={styles.card}
            data-passed={result.passed}
            initial={{ opacity: 0, y: 12, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: index * 0.08, type: 'spring', damping: 18 }}
          >
            <header className={styles.header}>
              <Mark passed={result.passed} />
              <span>Example {index + 1}</span>
              <span className={styles.status}>
                {describeStatus(result.status)}
              </span>
            </header>

            <dl className={styles.grid}>
              <dt>Input</dt>
              <dd><pre>{result.input}</pre></dd>
              <dt>Expected</dt>
              <dd><pre>{result.expectedOutput}</pre></dd>
              <dt>Your output</dt>
              <dd><pre>{result.stdout || '(nothing)'}</pre></dd>
              {result.stderr && (
                <>
                  <dt>Errors</dt>
                  <dd><pre className={styles.stderr}>{result.stderr}</pre></dd>
                </>
              )}
            </dl>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
