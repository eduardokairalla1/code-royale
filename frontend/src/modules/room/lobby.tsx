/**
 * Lobby: share the code, watch players arrive, the host sets up and starts.
 */

// --- IMPORTS ---
import { Annotate } from '../../components/annotate/annotate.tsx';
import { Button } from '../../components/button/button.tsx';
import { Paper } from '../../components/paper/paper.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import { LanguagePicker } from '../language/language-picker.tsx';
import { DifficultyPicker } from './difficulty-picker.tsx';
import styles from './lobby.module.css';
import { PlayerList } from './player-list.tsx';
import type { ChallengeDifficulty } from './room.types.ts';
import type { Room } from './room.types.ts';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// how long the "copied" bubble stays up
const COPIED_MS = 1400;

// --- CODE ---
/**
 * Props of the lobby.
 */
export interface LobbyProps {
  room: Room;
  selfId: string;
  // asks the server to start a round
  onStart: () => Promise<void>;
  // asks the server to draw only these difficulties
  onDifficulties: (difficulties: ChallengeDifficulty[]) => Promise<void>;
}

/**
 * Render the lobby of a room.
 *
 * @param {LobbyProps} props The room, who is looking and the host's
 *                           commands.
 *
 * @returns {JSX.Element} The lobby.
 */
export function Lobby({ room, selfId, onStart, onDifficulties }: LobbyProps) {

  const isHost = room.hostId === selfId;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start the round, showing why when it fails.
   *
   * @returns {Promise<void>}
   */
  async function handleStart(): Promise<void> {

    setStarting(true);
    setError(null);

    // started: the room state takes the screen away from here
    try {
      await onStart();

    // refused: say why and let them try again
    } catch (reason) {
      setError(describeUnknownError(reason));
      setStarting(false);
    }
  }

  return (
    <div className={styles.lobby}>
      <ShareCode code={room.code} />

      <Paper className={styles.players}>
        <h2 className={styles.title}>
          Players <span className={styles.count}>{room.players.length}</span>
        </h2>
        <PlayerList players={room.players} selfId={selfId} />
      </Paper>

      <DifficultyPicker
        difficulties={room.difficulties}
        editable={isHost}
        onChange={onDifficulties}
      />

      <LanguagePicker />

      <div className={styles.footer}>
        {isHost
          ? (
            <>
              <Button
                size="lg"
                disabled={starting}
                onClick={() => void handleStart()}
              >
                {starting ? 'Starting...' : 'Start match'}
              </Button>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )
          : <WaitingForHost />}
      </div>
    </div>
  );
}

/**
 * The room code, circled, with buttons to copy it or the invite link.
 *
 * @param {object} props The room code.
 * @param {string} props.code The room code.
 *
 * @returns {JSX.Element} The share card.
 */
function ShareCode({ code }: { code: string }) {

  const [copied, setCopied] = useState<string | null>(null);

  // hide the bubble after a moment
  useEffect(() => {

    if (copied === null) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(null), COPIED_MS);

    return () => window.clearTimeout(timer);
  }, [copied]);

  /**
   * Copy a text and show the bubble.
   *
   * @param {string} text What to copy.
   * @param {string} label What the bubble says was copied.
   *
   * @returns {Promise<void>}
   */
  async function copy(text: string, label: string): Promise<void> {

    // clipboard blocked: nothing copied, no bubble
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  const link = `${window.location.origin}/game/${code}`;

  return (
    <div className={styles.share}>
      <p className={styles.shareLabel}>Invite your friends with the code</p>
      <p className={styles.code}>
        <Annotate type="circle" color="var(--gem)" padding={10} delay={500}>
          {code}
        </Annotate>
      </p>
      <div className={styles.copyButtons}>
        <Button variant="secondary" onClick={() => void copy(code, 'Code')}>
          Copy code
        </Button>
        <Button variant="secondary" onClick={() => void copy(link, 'Link')}>
          Copy link
        </Button>

        <AnimatePresence>
          {copied && (
            <motion.span
              key={copied}
              className={styles.bubble}
              role="status"
              initial={{ opacity: 0, scale: 0.4, y: 10, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: -3 }}
              exit={{ opacity: 0, scale: 0.6, y: -10 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              {copied} copied!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Waiting text with bouncing dots, for everyone but the host.
 *
 * @returns {JSX.Element} The waiting text.
 */
function WaitingForHost() {

  return (
    <p className={styles.waiting}>
      Waiting for the host to start
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className={styles.dot}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: index * 0.15 }}
        >
          .
        </motion.span>
      ))}
    </p>
  );
}
