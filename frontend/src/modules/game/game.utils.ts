/**
 * Round helpers: clocks.
 */

// --- CODE ---
/**
 * Format a duration as a clock.
 *
 * @param {number} ms The duration, negative counts as zero.
 *
 * @returns {string} The clock, e.g. "4:07".
 */
export function formatClock(ms: number): string {

  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
