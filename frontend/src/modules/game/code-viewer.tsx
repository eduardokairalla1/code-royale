/**
 * The code a player submitted, on a sheet over the results.
 */

// --- IMPORTS ---
import { Button } from '../../components/button/button.tsx';
import { Scribble } from '../../components/scribble/scribble.tsx';
import { SketchFrame } from '../../components/sketch-frame/sketch-frame.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import { useLanguages } from '../language/language.api.ts';
import type { PlayerResult } from '../room/room.types.ts';
import styles from './code-viewer.module.css';
import type { Draft } from './game.types.ts';
import { formatClock } from './game.utils.ts';
import { motion } from 'motion/react';
import { Dialog } from 'radix-ui';
import { lazy } from 'react';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// the editor weighs megabytes: fetched only by those who look
const CodeEditor = lazy(async () => {
  const module = await import('./code-editor.tsx');
  return { default: module.CodeEditor };
});

// --- CODE ---
/**
 * Props of the code viewer.
 */
export interface CodeViewerProps {
  // whose code to show, null while closed
  result: PlayerResult | null;
  name: string;
  startedAt: number;
  loadCode: (playerId: string) => Promise<Draft>;
  onClose: () => void;
}

/**
 * Where loading the code stands.
 */
type CodeState =
  | { status: 'loading' }
  | { status: 'ready'; draft: Draft }
  | { status: 'failed'; message: string };

/**
 * Show a player's submitted code, read only.
 *
 * @param {CodeViewerProps} props Whose code, how they did and the exits.
 *
 * @returns {JSX.Element} The dialog, rendered only while open.
 */
export function CodeViewer({
  result,
  name,
  startedAt,
  loadCode,
  onClose,
}: CodeViewerProps) {

  return (
    <Dialog.Root
      open={result !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          {result && (
            <motion.div
              className={styles.sheet}
              initial={{ scale: 0.85, rotate: -2, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            >
              <SketchFrame fill="var(--paper-light)" shadow={6} />
              <div className={styles.body}>
                <SubmittedCode
                  key={result.playerId}
                  result={result}
                  name={name}
                  startedAt={startedAt}
                  loadCode={loadCode}
                />
                <div className={styles.actions}>
                  <Dialog.Close asChild>
                    <Button variant="secondary">Close</Button>
                  </Dialog.Close>
                </div>
              </div>
            </motion.div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The header and the code of one player, loaded on mount.
 *
 * @param {object} props Whose code and how to load it.
 * @param {PlayerResult} props.result The player's result.
 * @param {string} props.name The player's name.
 * @param {number} props.startedAt When the round started.
 * @param {(playerId: string) => Promise<Draft>} props.loadCode Fetches it.
 *
 * @returns {JSX.Element} The header and the editor.
 */
function SubmittedCode({
  result,
  name,
  startedAt,
  loadCode,
}: {
  result: PlayerResult;
  name: string;
  startedAt: number;
  loadCode: (playerId: string) => Promise<Draft>;
}) {

  const languages = useLanguages();
  const [state, setState] = useState<CodeState>({ status: 'loading' });

  useEffect(() => {

    let active = true;

    loadCode(result.playerId)
      .then((draft) => {
        if (active) {
          setState({ status: 'ready', draft });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: 'failed', message: describeUnknownError(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [loadCode, result.playerId]);

  const language = state.status === 'ready'
    ? languages?.find((item) => item.id === state.draft.language)?.name
      ?? state.draft.language
    : null;

  const details = [
    language,
    `${result.percentage ?? 0}% (${result.passed ?? 0}/${result.total ?? 0})`,
    result.submittedAt === null
      ? null
      : formatClock(result.submittedAt - startedAt),
  ].filter(Boolean).join(' · ');

  return (
    <>
      <header className={styles.header}>
        <Dialog.Title className={styles.title}>
          {`${name}'s code`}
        </Dialog.Title>
        <Dialog.Description className={styles.details}>
          {details}
          {result.autoSubmitted && (
            <span className={styles.badge}>auto-submitted</span>
          )}
        </Dialog.Description>
      </header>

      {state.status === 'loading' && (
        <div className={styles.placeholder}>
          <Scribble label="Fetching the code..." />
        </div>
      )}

      {state.status === 'failed' && (
        <p className={styles.error}>{state.message}</p>
      )}

      {state.status === 'ready' && (
        <Suspense fallback={<Scribble label="Opening the editor..." />}>
          <CodeEditor
            language={state.draft.language}
            value={state.draft.code}
            readOnly
            dimmed={false}
            onChange={ignoreChange}
          />
        </Suspense>
      )}
    </>
  );
}

/**
 * The viewer is read only: edits never happen.
 *
 * @returns {void}
 */
function ignoreChange(): void {}
