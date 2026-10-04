/**
 * Loading indicator: a pencil line scribbling back and forth.
 */

// --- IMPORTS ---
import styles from './scribble.module.css';

// --- GLOBALS ---
// a loose zigzag, drawn back and forth
const LINE = [
  'M2 12 C 8 2, 12 18, 18 8',
  'S 28 16, 32 6',
  'S 44 18, 48 8',
  'S 56 12, 58 10',
].join(' ');

// --- CODE ---
/**
 * Props of the scribble.
 */
export interface ScribbleProps {
  label: string;
}

/**
 * Render a scribbling line next to a label.
 *
 * @param {ScribbleProps} props What is loading.
 *
 * @returns {JSX.Element} The indicator.
 */
export function Scribble({ label }: ScribbleProps) {

  return (
    <span className={styles.scribble} role="status">
      <svg viewBox="0 0 60 20" className={styles.line} aria-hidden="true">
        <path d={LINE} />
      </svg>
      {label}
    </span>
  );
}
