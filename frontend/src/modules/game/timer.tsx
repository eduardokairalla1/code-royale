/**
 * Round countdown: calm at first, shaking red near the end.
 */

// --- IMPORTS ---
import { formatClock } from './game.utils.ts';
import styles from './timer.module.css';

// --- GLOBALS ---
// when the clock starts to worry, and when it panics
const WARNING_MS = 30_000;
const DANGER_MS = 10_000;

// --- CODE ---
/**
 * Props of the timer.
 */
export interface TimerProps {
  remainingMs: number;
}

/**
 * Render the time left.
 *
 * @param {TimerProps} props The time left, in ms.
 *
 * @returns {JSX.Element} The countdown.
 */
export function Timer({ remainingMs }: TimerProps) {

  const mood = remainingMs <= DANGER_MS
    ? 'danger'
    : remainingMs <= WARNING_MS ? 'warning' : 'calm';

  return (
    <div className={styles.timer} data-mood={mood}>
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13 L12 8.5 M12 13 L15 15 M10 3 L14 3 M12 3 L12 5" />
      </svg>
      <span className={styles.clock} aria-label="Time left">
        {formatClock(remainingMs)}
      </span>
    </div>
  );
}
