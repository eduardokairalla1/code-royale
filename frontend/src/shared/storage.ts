/**
 * Browser storage that never throws; blocked storage acts empty.
 */

// --- GLOBALS ---
const PREFIX = 'code-royale:';

// --- CODE ---
/**
 * Read a json value.
 *
 * @param {string} key The key, without the app prefix.
 *
 * @returns {T | null} The value, or null when missing or unreadable.
 */
export function readStored<T>(key: string): T | null {

  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);

  // blocked or corrupted: nothing stored
  } catch {
    return null;
  }
}

/**
 * Write a json value.
 *
 * @param {string} key The key, without the app prefix.
 * @param {unknown} value The value.
 *
 * @returns {void}
 */
export function writeStored(key: string, value: unknown): void {

  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));

  // blocked: the value only lives for this page
  } catch {
    // nothing to do
  }
}

/**
 * Remove a value.
 *
 * @param {string} key The key, without the app prefix.
 *
 * @returns {void}
 */
export function removeStored(key: string): void {

  try {
    window.localStorage.removeItem(PREFIX + key);

  // blocked: nothing was stored anyway
  } catch {
    // nothing to do
  }
}
