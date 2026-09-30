/**
 * Invite screen: someone opened a room link and needs a name to get in.
 */

// --- IMPORTS ---
import { Button } from '../../components/button/button.tsx';
import { Logo } from '../../components/logo/logo.tsx';
import { Notice } from '../../components/notice/notice.tsx';
import { Paper } from '../../components/paper/paper.tsx';
import { TextField } from '../../components/text-field/text-field.tsx';
import { ApiError } from '../../shared/errors.ts';
import { describeUnknownError } from '../../shared/errors.ts';
import styles from './join-room.module.css';
import { getRoom } from './room.api.ts';
import { joinRoom } from './room.api.ts';
import { checkName } from './room.schemas.ts';
import { readPlayerName } from './room.session.ts';
import { savePlayerName } from './room.session.ts';
import { saveSession } from './room.session.ts';
import type { Room } from './room.types.ts';
import type { Session } from './room.types.ts';
import { motion } from 'motion/react';
import type { FormEvent } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

// --- CODE ---
/**
 * What is known about the room before joining.
 */
type Lookup =
  | { state: 'loading' }
  | { state: 'found'; room: Room }
  | { state: 'missing' }
  | { state: 'failed'; message: string };

/**
 * Props of the invite screen.
 */
export interface JoinRoomProps {
  code: string;
  // called with the new identity once in
  onJoined: (session: Session) => void;
}

/**
 * Render the invite screen of a room.
 *
 * @param {JoinRoomProps} props The room code and what to do once in.
 *
 * @returns {JSX.Element} The invite screen.
 */
export function JoinRoom({ code, onJoined }: JoinRoomProps) {

  const navigate = useNavigate();
  const lookup = useRoomLookup(code);

  const [name, setName] = useState(readPlayerName);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  /**
   * Join the room with the typed name.
   *
   * @param {FormEvent} event The submit event.
   *
   * @returns {Promise<void>}
   */
  async function handleSubmit(event: FormEvent): Promise<void> {

    event.preventDefault();

    const checked = checkName(name);

    setError(checked.error);

    if (checked.value === null) {
      return;
    }

    setJoining(true);

    // in: remember who they are
    try {
      const response = await joinRoom(code, checked.value);

      savePlayerName(checked.value);
      onJoined(saveSession(response));

    // refused, e.g. the room filled up meanwhile
    } catch (reason) {
      setError(describeUnknownError(reason));
      setJoining(false);
    }
  }

  const goHome = (
    <Button variant="secondary" onClick={() => navigate('/')}>
      Back to home
    </Button>
  );

  if (lookup.state === 'missing') {
    return (
      <Notice title="Room not found" actions={goHome}>
        Check the code <strong>{code}</strong> or ask for a new link.
      </Notice>
    );
  }

  if (lookup.state === 'failed') {
    return (
      <Notice title="Oops!" actions={goHome}>
        {lookup.message}
      </Notice>
    );
  }

  const room = lookup.state === 'found' ? lookup.room : null;

  return (
    <main className={styles.page}>
      <Logo size="sm" />

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 30, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0.6 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      >
        <Paper>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.header}>
              <p className={styles.invited}>You were invited to the room</p>
              <p className={styles.code}>{code}</p>
              <p className={styles.count}>
                {room
                  ? `${room.players.length} playing now`
                  : 'Looking for the room...'}
              </p>
            </div>

            <TextField
              label="Your name"
              placeholder="Gabriel"
              value={name}
              maxLength={20}
              autoComplete="nickname"
              autoFocus
              error={error}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />

            <Button
              type="submit"
              size="lg"
              block
              disabled={joining || !room}
            >
              {joining ? 'Joining...' : 'Join'}
            </Button>

            <button
              type="button"
              className={styles.back}
              onClick={() => navigate('/')}
            >
              Back
            </button>
          </form>
        </Paper>
      </motion.div>
    </main>
  );
}

/**
 * Look a room up before joining it.
 *
 * @param {string} code The room code.
 *
 * @returns {Lookup} What is known about the room so far.
 */
function useRoomLookup(code: string): Lookup {

  const [lookup, setLookup] = useState<Lookup>({ state: 'loading' });

  useEffect(() => {

    let active = true;

    getRoom(code)
      .then((room) => {
        if (active) {
          setLookup({ state: 'found', room });
        }
      })
      .catch((reason: unknown) => {

        if (!active) {
          return;
        }

        // no such room: its own screen
        if (reason instanceof ApiError
          && reason.slug === 'room_not_found_error') {
          setLookup({ state: 'missing' });
          return;
        }

        setLookup({ state: 'failed', message: describeUnknownError(reason) });
      });

    return () => {
      active = false;
    };
  }, [code]);

  return lookup;
}
