/**
 * End of the round: the podium, the ranking, everyone's code, "play again".
 */

// --- IMPORTS ---
import crown from '../../assets/logo.png';
import { Annotate } from '../../components/annotate/annotate.tsx';
import { Button } from '../../components/button/button.tsx';
import { Paper } from '../../components/paper/paper.tsx';
import { SketchFrame } from '../../components/sketch-frame/sketch-frame.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import type { PlayerResult } from '../room/room.types.ts';
import type { Room } from '../room/room.types.ts';
import { CodeViewer } from './code-viewer.tsx';
import type { Draft } from './game.types.ts';
import { findPlayer } from './game.utils.ts';
import { findResult } from './game.utils.ts';
import { formatClock } from './game.utils.ts';
import styles from './results.module.css';
import { createSubmissionCache } from './submission-cache.ts';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// podium order on screen: second, first, third
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHTS = [150, 110, 80];

// paper scraps in the logo colors
const CONFETTI_COLORS = ['#ffd54a', '#f5a524', '#e5383b', '#3dbe6b'];

// --- CODE ---
/**
 * Props of the results.
 */
export interface ResultsProps {
  room: Room;
  selfId: string;
  // asks the server to send everyone back to the lobby
  onRestart: () => Promise<void>;
  // asks the server for the code a player submitted
  onLoadCode: (playerId: string) => Promise<Draft>;
}

/**
 * Render the results of the last round.
 *
 * @param {ResultsProps} props The room, who is looking and the commands.
 *
 * @returns {JSX.Element} The results screen.
 */
export function Results({
  room,
  selfId,
  onRestart,
  onLoadCode,
}: ResultsProps) {

  const round = room.round;
  const results = round?.results ?? [];
  const podium = results.filter((result) => result.position !== null)
    .slice(0, 3);
  const isHost = room.hostId === selfId;

  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PlayerResult | null>(null);

  // reopening someone's code does not ask the server again
  const [codes] = useState(() => createSubmissionCache(onLoadCode));

  // celebrate once, if anyone scored
  useEffect(() => {

    if (podium.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.35 },
        colors: CONFETTI_COLORS,
        disableForReducedMotion: true,
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [podium.length]);

  /**
   * Send everyone back to the lobby.
   *
   * @returns {Promise<void>}
   */
  async function handleRestart(): Promise<void> {

    setRestarting(true);
    setError(null);

    // back to the lobby: the room state takes the screen away
    try {
      await onRestart();

    // refused: say why
    } catch (reason) {
      setError(describeUnknownError(reason));
      setRestarting(false);
    }
  }

  /**
   * Name of a player, even after they left.
   *
   * @param {string} playerId The player's id.
   *
   * @returns {string} The name.
   */
  const nameOf = (playerId: string): string => {
    return findPlayer(room, playerId)?.name ?? 'Left';
  };

  return (
    <div className={styles.results}>
      <header className={styles.header}>
        <p className={styles.kicker}>End of round</p>
        <h2 className={styles.title}>{round?.challenge.title}</h2>
      </header>

      {podium.length > 0 && (
        <div className={styles.podium}>
          {PODIUM_ORDER.map((place) => {
            const result = podium[place];

            return result
              ? (
                <PodiumStep
                  key={result.playerId}
                  place={place}
                  name={nameOf(result.playerId)}
                  percentage={result.percentage ?? 0}
                />
              )
              : <div key={place} />;
          })}
        </div>
      )}

      <OwnResult
        result={findResult(room, selfId)}
        startedAt={round?.startedAt ?? 0}
      />

      <Paper className={styles.ranking}>
        <h3 className={styles.rankingTitle}>Ranking</h3>
        <ol className={styles.list}>
          {results.map((result, index) => (
            <motion.li
              key={result.playerId}
              className={styles.row}
              data-self={result.playerId === selfId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + index * 0.08 }}
            >
              <span className={styles.position}>
                {result.position ?? '–'}
              </span>
              <span className={styles.name}>
                {nameOf(result.playerId)}
                {result.playerId === selfId && ' (you)'}
              </span>
              <ResultCells result={result} startedAt={round?.startedAt ?? 0} />
              {result.submittedAt !== null && (
                <Button
                  variant="secondary"
                  className={styles.viewCode}
                  aria-label={`View ${nameOf(result.playerId)}'s code`}
                  onClick={() => setViewing(result)}
                >
                  Code
                </Button>
              )}
            </motion.li>
          ))}
        </ol>
      </Paper>

      <div className={styles.footer}>
        {isHost
          ? (
            <Button
              size="lg"
              disabled={restarting}
              onClick={() => void handleRestart()}
            >
              {restarting ? 'Going back...' : 'Play again'}
            </Button>
          )
          : <p className={styles.waiting}>Waiting for the host...</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <CodeViewer
        result={viewing}
        name={viewing ? nameOf(viewing.playerId) : ''}
        startedAt={round?.startedAt ?? 0}
        loadCode={codes.get}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

/**
 * One step of the podium, the crown landing on the winner.
 *
 * @param {object} props The place and the player on it.
 * @param {number} props.place 0 for first, 1 for second, 2 for third.
 * @param {string} props.name The player's name.
 * @param {number} props.percentage The player's score.
 *
 * @returns {JSX.Element} The podium step.
 */
function PodiumStep({
  place,
  name,
  percentage,
}: {
  place: number;
  name: string;
  percentage: number;
}) {

  // third rises first, the winner last
  const delay = (2 - place) * 0.25;

  return (
    <motion.div
      className={styles.step}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 18 }}
    >
      {place === 0 && (
        <motion.img
          src={crown}
          alt=""
          className={styles.crown}
          initial={{ y: -200, rotate: -30, opacity: 0 }}
          animate={{ y: 0, rotate: -8, opacity: 1 }}
          transition={{
            delay: 0.8,
            type: 'spring',
            stiffness: 300,
            damping: 10,
          }}
        />
      )}
      <span className={styles.stepName}>{name}</span>
      <span className={styles.stepScore}>{percentage}%</span>
      <div className={styles.block} style={{ height: PODIUM_HEIGHTS[place] }}>
        <SketchFrame
          fill={place === 0 ? 'var(--crown)' : 'var(--paper-light)'}
          fillStyle={place === 0 ? 'solid' : 'hachure'}
          shadow={5}
        />
        <span className={styles.place}>{place + 1}</span>
      </div>
    </motion.div>
  );
}

/**
 * How the player looking did, in one sentence and a big number.
 *
 * @param {object} props The player's result and when the round started.
 * @param {PlayerResult | null} props.result Null when they only watched.
 * @param {number} props.startedAt When the round started.
 *
 * @returns {JSX.Element} The player's own result.
 */
function OwnResult({
  result,
  startedAt,
}: {
  result: PlayerResult | null;
  startedAt: number;
}) {

  const message = !result
    ? 'You watched this round. You play the next one!'
    : result.position === null
      ? 'You did not submit anything this time.'
      : result.position === 1
        ? 'You took the crown!'
        : `You finished #${result.position}.`;

  return (
    <motion.div
      className={styles.own}
      initial={{ scale: 0.7, rotate: -4, opacity: 0 }}
      animate={{ scale: 1, rotate: 1, opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 320, damping: 16 }}
    >
      <Paper fill={result?.position === 1 ? 'var(--crown)' : undefined}>
        <div className={styles.ownContent}>
          {result?.position != null && (
            <span className={styles.ownPosition}>
              <Annotate type="circle" color="var(--gem)" delay={1400}>
                {/* one text node: two would get a circle each */}
                {`#${result.position}`}
              </Annotate>
            </span>
          )}
          <div>
            <p className={styles.ownMessage}>{message}</p>
            {result?.submittedAt != null && (
              <p className={styles.ownDetails}>
                {result.percentage ?? 0}% of the tests
                ({result.passed ?? 0}/{result.total ?? 0}) in{' '}
                {formatClock(result.submittedAt - startedAt)}
                {result.autoSubmitted && ', submitted when time ran out'}
              </p>
            )}
          </div>
        </div>
      </Paper>
    </motion.div>
  );
}

/**
 * Score, tests and time of one ranking row.
 *
 * @param {object} props The result and when the round started.
 * @param {PlayerResult} props.result The player's result.
 * @param {number} props.startedAt When the round started.
 *
 * @returns {JSX.Element} The cells.
 */
function ResultCells({
  result,
  startedAt,
}: {
  result: PlayerResult;
  startedAt: number;
}) {

  if (result.submittedAt === null) {
    return <span className={styles.missing}>no submission</span>;
  }

  return (
    <>
      {result.autoSubmitted && (
        <span className={styles.badge}>auto-submitted</span>
      )}
      <span className={styles.time}>
        {formatClock(result.submittedAt - startedAt)}
      </span>
      <span className={styles.score}>
        {result.percentage ?? 0}%
        <small>
          {result.passed ?? 0}/{result.total ?? 0}
        </small>
      </span>
    </>
  );
}
