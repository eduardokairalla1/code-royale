/**
 * Rubber stamp slammed over the screen: "GO!", "SUBMITTED!", "TIME!".
 */

// --- IMPORTS ---
import styles from './stamp.module.css';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect } from 'react';

// --- GLOBALS ---
// how long the stamp stays on screen
const STAMP_MS = 1300;

// --- CODE ---
/**
 * Props of the stamp.
 */
export interface StampProps {
  // the word to stamp, nothing when null
  text: string | null;
  color?: string;
  // called once the stamp is gone
  onDone: () => void;
}

/**
 * Slam a word over the screen, then lift it.
 *
 * @param {StampProps} props The word, its color and the done callback.
 *
 * @returns {JSX.Element} The stamp overlay.
 */
export function Stamp({ text, color = 'var(--gem)', onDone }: StampProps) {

  // lift it after a moment
  useEffect(() => {

    if (text === null) {
      return;
    }

    const timer = window.setTimeout(onDone, STAMP_MS);

    return () => window.clearTimeout(timer);
  }, [text, onDone]);

  return (
    <AnimatePresence>
      {text !== null && (
        <motion.div
          key={text}
          className={styles.overlay}
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <motion.span
            className={styles.stamp}
            style={{ color, borderColor: color }}
            initial={{ scale: 3, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 22 }}
          >
            {text}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
