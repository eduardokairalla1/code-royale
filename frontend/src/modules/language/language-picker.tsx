/**
 * Pick the language the editor opens with in the next rounds.
 */

// --- IMPORTS ---
import { Select } from '../../components/select/select.tsx';
import styles from './language-picker.module.css';
import { readPreferredLanguage } from './language.api.ts';
import { savePreferredLanguage } from './language.api.ts';
import { useLanguages } from './language.api.ts';
import { useState } from 'react';

// --- CODE ---
/**
 * Render the preferred language picker.
 *
 * @returns {JSX.Element | null} The picker, nothing until languages load.
 */
export function LanguagePicker() {

  const languages = useLanguages();
  const [picked, setPicked] = useState(readPreferredLanguage);

  // still loading, or the backend is down: the editor has its own picker
  if (!languages || languages.length === 0) {
    return null;
  }

  // never picked, or no longer enabled: the first one
  const value = languages.find((language) => language.id === picked)?.id
    ?? languages[0]?.id
    ?? '';

  return (
    <div className={styles.picker}>
      <span className={styles.label}>I will play with</span>
      <Select
        label="Preferred language"
        value={value}
        options={languages.map((language) => ({
          value: language.id,
          label: language.name,
        }))}
        onChange={(id) => {
          setPicked(id);
          savePreferredLanguage(id);
        }}
      />
    </div>
  );
}
