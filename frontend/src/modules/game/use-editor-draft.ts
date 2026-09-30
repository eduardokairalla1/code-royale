/**
 * The editor's code, kept in the browser and synced to the server.
 */

// --- IMPORTS ---
import { readStored } from '../../shared/storage.ts';
import { writeStored } from '../../shared/storage.ts';
import type { Language } from '../language/language.api.ts';
import { readPreferredLanguage } from '../language/language.api.ts';
import { savePreferredLanguage } from '../language/language.api.ts';
import type { Draft } from './game.types.ts';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import { useState } from 'react';

// --- CODE ---
/**
 * What the editor draft exposes.
 */
export interface EditorDraft {
  // null until the languages are known
  draft: Draft | null;
  // the language's starting code, to tell edited code apart
  template: string;
  setCode: (code: string) => void;
  setLanguage: (id: string) => void;
}

/**
 * Keep the editor draft of one round.
 *
 * @param {string} roundKey Unique per room and round.
 * @param {Language[] | null} languages The languages, null while loading.
 *
 * @returns {EditorDraft} The draft and its setters.
 */
export function useEditorDraft(
  roundKey: string,
  languages: Language[] | null,
): EditorDraft {

  const storageKey = `draft:${roundKey}`;
  const [stored, setStored] = useState(() => readStored<Draft>(storageKey));

  // before any typing: the preferred language and its template
  const draft = useMemo(() => {
    return stored ?? (languages ? startingDraft(languages) : null);
  }, [stored, languages]);

  const template = languages?.find((language) => {
    return language.id === draft?.language;
  })?.template ?? '';

  // keep it in the browser, so a reload loses nothing
  useEffect(() => {
    if (stored) {
      writeStored(storageKey, stored);
    }
  }, [stored, storageKey]);

  const setCode = useCallback((code: string) => {
    setStored((current) => {
      const base = current ?? draft;
      return base ? { ...base, code } : current;
    });
  }, [draft]);

  const setLanguage = useCallback((id: string) => {

    const language = languages?.find((candidate) => candidate.id === id);

    if (!language) {
      return;
    }

    savePreferredLanguage(id);
    setStored({ language: id, code: language.template });
  }, [languages]);

  return { draft, template, setCode, setLanguage };
}

/**
 * The draft a round starts with.
 *
 * @param {Language[]} languages The enabled languages.
 *
 * @returns {Draft | null} The preferred language and its template.
 */
function startingDraft(languages: Language[]): Draft | null {

  const preferred = readPreferredLanguage();
  const language = languages.find((candidate) => candidate.id === preferred)
    ?? languages[0];

  return language ? { language: language.id, code: language.template } : null;
}
