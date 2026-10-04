/**
 * The difficulties the next rounds may draw: the host picks, all see them.
 */

// --- IMPORTS ---
import { describeUnknownError } from '../../shared/errors.ts';
import styles from './difficulty-picker.module.css';
import { DIFFICULTIES } from './room.difficulties.ts';
import { DIFFICULTY_LABELS } from './room.difficulties.ts';
import { toggleDifficulty } from './room.difficulties.ts';
import type { ChallengeDifficulty } from './room.types.ts';
import { useId } from 'react';
import { useState } from 'react';

// --- CODE ---
/**
 * Props of the difficulty picker.
 */
export interface DifficultyPickerProps {
  // what the room draws from now
  difficulties: ChallengeDifficulty[];
  // only the host may change them
  editable: boolean;
  // asks the server to change them
  onChange: (difficulties: ChallengeDifficulty[]) => Promise<void>;
}

/**
 * Render a toggle per difficulty.
 *
 * @param {DifficultyPickerProps} props The pick, who may change it and how.
 *
 * @returns {JSX.Element} The picker.
 */
export function DifficultyPicker({
  difficulties,
  editable,
  onChange,
}: DifficultyPickerProps) {

  const labelId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Turn a difficulty on or off, showing why when it fails.
   *
   * @param {ChallengeDifficulty} difficulty The one clicked.
   *
   * @returns {Promise<void>}
   */
  async function handleToggle(difficulty: ChallengeDifficulty): Promise<void> {

    const next = toggleDifficulty(difficulties, difficulty);

    // the last one left stays on
    if (!next) {
      return;
    }

    setSaving(true);
    setError(null);

    // saved: the room state brings the new pick
    try {
      await onChange(next);
    } catch (reason) {
      setError(describeUnknownError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.picker}>
      <div className={styles.row}>
        <span className={styles.label} id={labelId}>Challenges</span>
        <div
          className={styles.options}
          role="group"
          aria-labelledby={labelId}
        >
          {DIFFICULTIES.map((difficulty) => {
            const picked = difficulties.includes(difficulty);
            const last = picked && difficulties.length === 1;

            return (
              <button
                key={difficulty}
                type="button"
                className={styles.option}
                data-difficulty={difficulty}
                aria-pressed={picked}
                disabled={!editable || saving || last}
                title={last && editable ? 'Keep at least one' : undefined}
                onClick={() => void handleToggle(difficulty)}
              >
                {DIFFICULTY_LABELS[difficulty]}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
