/**
 * Home: pick a name, then create a room or join one by its code.
 */

// --- IMPORTS ---
import { Button } from '../../components/button/button.tsx';
import { Logo } from '../../components/logo/logo.tsx';
import { Paper } from '../../components/paper/paper.tsx';
import { TextField } from '../../components/text-field/text-field.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import { createRoom } from '../room/room.api.ts';
import { joinRoom } from '../room/room.api.ts';
import { checkCode } from '../room/room.schemas.ts';
import { checkName } from '../room/room.schemas.ts';
import { readPlayerName } from '../room/room.session.ts';
import { savePlayerName } from '../room/room.session.ts';
import { saveSession } from '../room/room.session.ts';
import type { JoinResponse } from '../room/room.types.ts';
import styles from './home.module.css';
import { motion } from 'motion/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

// --- GLOBALS ---
const REPO_URL = 'https://github.com/eduardokairalla1/code-royale';

const AUTHOR_LINKS = [
  { label: 'GitHub', href: 'https://github.com/eduardokairalla1' },
  { label: 'Site', href: 'https://eduardokairalla.com/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/eduardo-kairalla1' },
];

// --- CODE ---
/**
 * What the home is busy doing.
 */
type Pending = 'create' | 'join' | null;

/**
 * Render the home.
 *
 * @returns {JSX.Element} The home.
 */
export function HomePage() {

  const navigate = useNavigate();

  const [name, setName] = useState(readPlayerName);
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  /**
   * Validate the name, then run the call that enters a room.
   *
   * @param {Exclude<Pending, null>} action Which button was used.
   * @param {(name: string) => Promise<JoinResponse>} enter The call.
   *
   * @returns {Promise<void>}
   */
  async function enterRoom(
    action: Exclude<Pending, null>,
    enter: (name: string) => Promise<JoinResponse>,
  ): Promise<void> {

    const checked = checkName(name);

    setNameError(checked.error);

    if (checked.value === null) {
      return;
    }

    setPending(action);

    // in: remember who they are and go to the room
    try {
      const response = await enter(checked.value);

      savePlayerName(checked.value);
      saveSession(response);
      navigate(`/game/${response.room.code}`);

    // refused: the code field is the one to fix when joining
    } catch (error) {
      const message = describeUnknownError(error);

      if (action === 'join') {
        setCodeError(message);
      } else {
        setNameError(message);
      }

      setPending(null);
    }
  }

  /**
   * Join by code, from the form's submit.
   *
   * @param {FormEvent} event The submit event.
   *
   * @returns {void}
   */
  function handleJoin(event: FormEvent): void {

    event.preventDefault();

    const checked = checkCode(code);

    setCodeError(checked.error);

    if (checked.value !== null) {
      const roomCode = checked.value;
      void enterRoom('join', (player) => joinRoom(roomCode, player));
    }
  }

  return (
    <main className={styles.page}>
      <Logo />

      <motion.p
        className={styles.tagline}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        One challenge, one clock, the best coder takes the crown.
      </motion.p>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -0.6 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 16 }}
      >
        <Paper>
          <div className={styles.form}>
            <TextField
              label="Your name"
              placeholder="Lucas"
              value={name}
              maxLength={20}
              autoComplete="nickname"
              error={nameError}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
            />

            <Button
              size="lg"
              block
              disabled={pending !== null}
              onClick={() => void enterRoom('create', createRoom)}
            >
              {pending === 'create' ? 'Creating...' : 'Create room'}
            </Button>

            <div className={styles.divider} aria-hidden="true">
              <span>or</span>
            </div>

            <form className={styles.join} onSubmit={handleJoin}>
              <TextField
                label="Room code"
                placeholder="X7K2P"
                value={code}
                maxLength={10}
                autoComplete="off"
                code
                error={codeError}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeError(null);
                }}
              />
              <Button
                type="submit"
                variant="secondary"
                block
                disabled={pending !== null}
              >
                {pending === 'join' ? 'Joining...' : 'Join'}
              </Button>
            </form>
          </div>
        </Paper>
      </motion.div>

      <motion.footer
        className={styles.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <p>
          Open source project.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            See the code on GitHub
          </a>
        </p>
        <p>
          Created by Eduardo Kairalla
          {AUTHOR_LINKS.map((link) => (
            <span key={link.href}>
              {' · '}
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </span>
          ))}
        </p>
      </motion.footer>
    </main>
  );
}
