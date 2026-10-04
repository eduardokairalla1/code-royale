/**
 * Languages players can write in, fetched once and shared by every screen.
 */

// --- IMPORTS ---
import { request } from '../../shared/http.ts';
import { readStored } from '../../shared/storage.ts';
import { writeStored } from '../../shared/storage.ts';
import { useEffect } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
const PREFERRED_KEY = 'preferred-language';

// the one request, shared by everyone who asks
let pending: Promise<Language[]> | null = null;

// --- CODE ---
/**
 * A language players can pick.
 */
export interface Language {
  id: string;
  name: string;
  // starting code: reads stdin, so players only write the logic
  template: string;
}

/**
 * Fetch the enabled languages, once per page load.
 *
 * @returns {Promise<Language[]>} The languages, in catalog order.
 *
 * @throws {ApiError} When the backend cannot be reached.
 */
export function fetchLanguages(): Promise<Language[]> {

  // failed: let the next caller try again
  pending ??= request<Language[]>('GET', '/languages').catch((error) => {
    pending = null;
    throw error;
  });

  return pending;
}

/**
 * Load the languages for a component.
 *
 * @returns {Language[] | null} The languages, null while loading.
 */
export function useLanguages(): Language[] | null {

  const [languages, setLanguages] = useState<Language[] | null>(null);

  useEffect(() => {

    let active = true;

    fetchLanguages()
      .then((loaded) => {
        if (active) {
          setLanguages(loaded);
        }
      })
      .catch(() => {
        // the editor falls back to plain text until a reload
      });

    return () => {
      active = false;
    };
  }, []);

  return languages;
}

/**
 * The language the player used last time.
 *
 * @returns {string | null} Its id, or null when never picked.
 */
export function readPreferredLanguage(): string | null {
  return readStored<string>(PREFERRED_KEY);
}

/**
 * Remember the language for the next rounds.
 *
 * @param {string} id The language id.
 *
 * @returns {void}
 */
export function savePreferredLanguage(id: string): void {
  writeStored(PREFERRED_KEY, id);
}
