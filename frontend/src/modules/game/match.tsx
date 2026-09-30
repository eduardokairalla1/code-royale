/**
 * Round screen of a player: statement, editor, examples and ranking.
 */

// --- IMPORTS ---
import {
  ConfirmDialog,
} from '../../components/confirm-dialog/confirm-dialog.tsx';
import { Scribble } from '../../components/scribble/scribble.tsx';
import { Select } from '../../components/select/select.tsx';
import { Stamp } from '../../components/stamp/stamp.tsx';
import { useLanguages } from '../language/language.api.ts';
import type { Room } from '../room/room.types.ts';
import styles from './match.module.css';
import { Problem } from './problem.tsx';
import { Scoreboard } from './scoreboard.tsx';
import { Timer } from './timer.tsx';
import { useEditorDraft } from './use-editor-draft.ts';
import { useServerNow } from './use-server-now.ts';
import { lazy } from 'react';
import { Suspense } from 'react';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// the editor weighs megabytes: fetched only by those who type
const CodeEditor = lazy(async () => {
  const module = await import('./code-editor.tsx');
  return { default: module.CodeEditor };
});

// a round this fresh greets the player with a stamp
const FRESH_ROUND_MS = 4000;

// --- CODE ---
/**
 * A stamp to slam on screen.
 */
interface StampState {
  text: string;
  color: string;
}

/**
 * Props of the match.
 */
export interface MatchProps {
  room: Room;
  selfId: string;
  clockOffset: number;
}

/**
 * Render the round for a player taking part in it.
 *
 * @param {MatchProps} props The room, who is playing and the clock.
 *
 * @returns {JSX.Element} The match screen.
 */
export function Match({ room, selfId, clockOffset }: MatchProps) {

  // the room view only renders the match during a round
  const round = room.round as NonNullable<Room['round']>;

  const languages = useLanguages();
  const now = useServerNow(clockOffset);
  const remainingMs = round.endsAt - now;
  const timeUp = remainingMs <= 0;

  const editor = useEditorDraft(
    `${room.code}:${round.startedAt}`,
    languages,
  );

  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [stamp, setStamp] = useState<StampState | null>(() => {
    return now - round.startedAt < FRESH_ROUND_MS
      ? { text: 'GO!', color: 'var(--gem)' }
      : null;
  });

  const locked = timeUp;

  useTimeUp(timeUp, () => {
    setStamp({ text: 'TIME!', color: 'var(--gem)' });
  });

  /**
   * Switch language, asking first when that throws edited code away.
   *
   * @param {string} id The new language id.
   *
   * @returns {void}
   */
  function handleLanguage(id: string): void {

    const edited = editor.draft !== null
      && editor.draft.code.trim() !== ''
      && editor.draft.code !== editor.template;

    if (edited) {
      setPendingLanguage(id);
    } else {
      editor.setLanguage(id);
    }
  }

  const clearStamp = useCallback(() => setStamp(null), []);

  return (
    <div className={styles.match}>
      <div className={styles.bar}>
        <Timer remainingMs={remainingMs} />
      </div>

      <div className={styles.grid}>
        <div className={styles.side}>
          <Problem challenge={round.challenge} />
          <Scoreboard room={room} selfId={selfId} />
        </div>

        <div className={styles.work}>
          <div className={styles.toolbar}>
            <Select
              label="Language"
              value={editor.draft?.language ?? ''}
              options={(languages ?? []).map((language) => ({
                value: language.id,
                label: language.name,
              }))}
              disabled={locked || !languages}
              onChange={handleLanguage}
            />
          </div>

          <Suspense fallback={<Scribble label="Opening the editor..." />}>
            {editor.draft
              ? (
                <CodeEditor
                  language={editor.draft.language}
                  value={editor.draft.code}
                  readOnly={locked}
                  onChange={editor.setCode}
                />
              )
              : <Scribble label="Loading languages..." />}
          </Suspense>
        </div>
      </div>

      <ConfirmDialog
        open={pendingLanguage !== null}
        title="Switch language?"
        confirmLabel="Switch"
        onConfirm={() => {
          if (pendingLanguage) {
            editor.setLanguage(pendingLanguage);
          }
          setPendingLanguage(null);
        }}
        onCancel={() => setPendingLanguage(null)}
      >
        The code you wrote will be replaced by the new language template.
      </ConfirmDialog>

      <Stamp
        text={stamp?.text ?? null}
        color={stamp?.color}
        onDone={clearStamp}
      />
    </div>
  );
}

/**
 * Run a callback once, the moment a condition turns true.
 *
 * @param {boolean} condition The condition.
 * @param {() => void} callback What to run.
 *
 * @returns {void}
 */
function useTimeUp(condition: boolean, callback: () => void): void {

  const fired = useRef(false);
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (condition && !fired.current) {
      fired.current = true;
      latest.current();
    }
  }, [condition]);
}
