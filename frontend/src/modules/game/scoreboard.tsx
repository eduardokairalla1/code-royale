/**
 * Live ranking of the round, reordering itself as verdicts land.
 */

// --- IMPORTS ---
import { Paper } from '../../components/paper/paper.tsx';
import type { PlayerResult } from '../room/room.types.ts';
import type { Room } from '../room/room.types.ts';
import { findPlayer } from './game.utils.ts';
import styles from './scoreboard.module.css';
import { motion } from 'motion/react';

// --- CODE ---
/**
 * Props of the scoreboard.
 */
export interface ScoreboardProps {
  room: Room;
  selfId: string;
}

/**
 * Render the ranking of the round.
 *
 * @param {ScoreboardProps} props The room and who is looking.
 *
 * @returns {JSX.Element} The scoreboard.
 */
export function Scoreboard({ room, selfId }: ScoreboardProps) {

  const results = room.round?.results ?? [];

  return (
    <Paper className={styles.board}>
      <h2 className={styles.title}>Scoreboard</h2>

      {results.length === 0 && (
        <p className={styles.empty}>Nobody in this round.</p>
      )}

      <ol className={styles.list}>
        {results.map((result) => (
          <motion.li
            key={result.playerId}
            layout
            className={styles.row}
            data-self={result.playerId === selfId}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <span className={styles.position}>
              {result.position ?? '–'}
            </span>
            <span className={styles.name}>
              {findPlayer(room, result.playerId)?.name ?? 'Left'}
            </span>
            <ResultState result={result} />
          </motion.li>
        ))}
      </ol>
    </Paper>
  );
}

/**
 * Where one player stands: coding, being judged or scored.
 *
 * @param {object} props The player's result.
 * @param {PlayerResult} props.result The result.
 *
 * @returns {JSX.Element} The state label.
 */
function ResultState({ result }: { result: PlayerResult }) {

  if (result.submittedAt === null) {
    return <span className={styles.state}>coding...</span>;
  }

  if (result.percentage === null) {
    return (
      <span className={styles.state} data-state="judging">
        judging...
      </span>
    );
  }

  return (
    <motion.span
      key="score"
      className={styles.state}
      data-state={result.percentage === 100 ? 'perfect' : 'scored'}
      initial={{ scale: 1.8, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 14 }}
    >
      {result.percentage}%
      <small className={styles.tests}>
        {result.passed}/{result.total}
      </small>
    </motion.span>
  );
}
