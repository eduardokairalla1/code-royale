/**
 * Round screen of a player: statement, editor, examples and ranking.
 */

// --- IMPORTS ---
import { Button } from '../../components/button/button.tsx';
import {
  ConfirmDialog,
} from '../../components/confirm-dialog/confirm-dialog.tsx';
import { Scribble } from '../../components/scribble/scribble.tsx';
import { Select } from '../../components/select/select.tsx';
import { Stamp } from '../../components/stamp/stamp.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import { useLanguages } from '../language/language.api.ts';
import type { Room } from '../room/room.types.ts';
import type { Draft } from './game.types.ts';
import type { ExampleResult } from './game.types.ts';
import type { Verdict } from './game.types.ts';
import { findResult } from './game.utils.ts';
import styles from './match.module.css';
import { Problem } from './problem.tsx';
import { RunOutput } from './run-output.tsx';
import { Scoreboard } from './scoreboard.tsx';
import { Timer } from './timer.tsx';
import { useEditorDraft } from './use-editor-draft.ts';
import { useServerNow } from './use-server-now.ts';
import { VerdictCard } from './verdict-card.tsx';
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
  send: (event: string, payload?: unknown) => Promise<unknown>;
}

/**
 * Render the round for a player taking part in it.
 *
 * @param {MatchProps} props The room, who is playing, the clock and send.
 *
 * @returns {JSX.Element} The match screen.
 */
export function Match({ room, selfId, clockOffset, send }: MatchProps) {

  // the room view only renders the match during a round
  const round = room.round as NonNullable<Room['round']>;
  const result = findResult(room, selfId);

  const languages = useLanguages();
  const now = useServerNow(clockOffset);
  const remainingMs = round.endsAt - now;
  const timeUp = remainingMs <= 0;

  const syncDraft = useCallback((draft: Draft) => {
    return send('submission:draft', draft);
  }, [send]);

  const editor = useEditorDraft(
    `${room.code}:${round.startedAt}`,
    languages,
    syncDraft,
  );

  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<ExampleResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [stamp, setStamp] = useState<StampState | null>(() => {
    return now - round.startedAt < FRESH_ROUND_MS
      ? { text: 'GO!', color: 'var(--gem)' }
      : null;
  });

  const submitted = result?.submittedAt != null;
  const locked = submitted || submitting || timeUp;
  const hasCode = Boolean(editor.draft?.code.trim());

  useTimeUp(timeUp && !submitted, () => {
    editor.flush();
    setStamp({ text: 'TIME!', color: 'var(--gem)' });
  });

  /**
   * Run the code against the public examples.
   *
   * @returns {Promise<void>}
   */
  async function handleRun(): Promise<void> {

    if (!editor.draft) {
      return;
    }

    setRunning(true);
    setError(null);

    // ran: show every example's output
    try {
      const results = await send('submission:run', editor.draft);
      setRunResults(results as ExampleResult[]);

    // refused or unreachable: say why
    } catch (reason) {
      setError(describeUnknownError(reason));
    } finally {
      setRunning(false);
    }
  }

  /**
   * Submit the code, once, against the hidden tests.
   *
   * @returns {Promise<void>}
   */
  async function handleSubmit(): Promise<void> {

    setConfirmSubmit(false);

    if (!editor.draft) {
      return;
    }

    setSubmitting(true);
    setError(null);

    // judged: stamp it and show the score
    try {
      const judged = await send('submission:submit', editor.draft);

      setVerdict(judged as Verdict);
      setStamp({ text: 'SUBMITTED!', color: 'var(--success)' });

    // not judged: the server undid it, so they may try again
    } catch (reason) {
      setError(describeUnknownError(reason));
    } finally {
      setSubmitting(false);
    }
  }

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

            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={locked || running || !hasCode}
                onClick={() => void handleRun()}
              >
                {running ? 'Running...' : 'Run'}
              </Button>
              <Button
                disabled={locked || running || !hasCode}
                onClick={() => setConfirmSubmit(true)}
              >
                {submitting ? 'Judging...' : 'Submit'}
              </Button>
            </div>
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

          {error && <p className={styles.error} role="alert">{error}</p>}

          {submitting && <Scribble label="Running the hidden tests..." />}

          {result && result.submittedAt !== null && result.passed !== null && (
            <VerdictCard
              passed={result.passed}
              total={result.total ?? 0}
              percentage={result.percentage ?? 0}
              status={verdict?.status ?? null}
              compileError={verdict?.compileError ?? null}
              autoSubmitted={result.autoSubmitted}
            />
          )}

          {timeUp && !submitted && (
            <Scribble label="Time is up! Submitting your code..." />
          )}

          {running && <Scribble label="Running the examples..." />}
          {!running && runResults && <RunOutput results={runResults} />}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit now?"
        confirmLabel="Submit"
        onConfirm={() => void handleSubmit()}
        onCancel={() => setConfirmSubmit(false)}
      >
        You can only submit once this round. Your code will run against the
        hidden tests.
      </ConfirmDialog>

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
