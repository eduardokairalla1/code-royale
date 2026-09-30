/**
 * Round screen of someone who joined mid round: watch now, play next.
 */

// --- IMPORTS ---
import type { Room } from '../room/room.types.ts';
import styles from './match.module.css';
import { Problem } from './problem.tsx';
import { Scoreboard } from './scoreboard.tsx';
import spectatorStyles from './spectator.module.css';
import { Timer } from './timer.tsx';
import { useServerNow } from './use-server-now.ts';

// --- CODE ---
/**
 * Props of the spectator view.
 */
export interface SpectatorProps {
  room: Room;
  selfId: string;
  clockOffset: number;
}

/**
 * Render the round, read only.
 *
 * @param {SpectatorProps} props The room, who is watching and the clock.
 *
 * @returns {JSX.Element} The spectator screen.
 */
export function Spectator({ room, selfId, clockOffset }: SpectatorProps) {

  // the room view only renders this during a round
  const round = room.round as NonNullable<Room['round']>;
  const now = useServerNow(clockOffset);

  return (
    <div className={styles.match}>
      <div className={styles.bar}>
        <Timer remainingMs={round.endsAt - now} />
      </div>

      <p className={spectatorStyles.notice}>
        Round in progress: watch now, you join the next one!
      </p>

      <div className={styles.grid}>
        <div className={styles.side}>
          <Problem challenge={round.challenge} />
        </div>
        <div className={styles.work}>
          <Scoreboard room={room} selfId={selfId} />
        </div>
      </div>
    </div>
  );
}
