/**
 * The server's clock, ticking, for countdowns every player sees alike.
 */

// --- IMPORTS ---
import { useEffect } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
const TICK_MS = 250;

// --- CODE ---
/**
 * Tick with the server's current time.
 *
 * @param {number} clockOffset Server clock minus local clock, in ms.
 *
 * @returns {number} The server's time now, in ms since the epoch.
 */
export function useServerNow(clockOffset: number): number {

  const [now, setNow] = useState(() => Date.now() + clockOffset);

  useEffect(() => {

    const timer = window.setInterval(() => {
      setNow(Date.now() + clockOffset);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [clockOffset]);

  return now;
}
