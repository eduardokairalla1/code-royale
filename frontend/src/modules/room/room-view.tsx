/**
 * A connected room: the screen for its status and connection states.
 */

// --- IMPORTS ---
import { Button } from '../../components/button/button.tsx';
import { Logo } from '../../components/logo/logo.tsx';
import { Notice } from '../../components/notice/notice.tsx';
import { ToastStack } from '../../components/toast/toast-stack.tsx';
import { describeUnknownError } from '../../shared/errors.ts';
import { Lobby } from './lobby.tsx';
import styles from './room-view.module.css';
import { useRoomNotices } from './room.notices.ts';
import type { Session } from './room.types.ts';
import { useRoomConnection } from './use-room-connection.ts';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

// --- CODE ---
/**
 * Props of the room view.
 */
export interface RoomViewProps {
  code: string;
  session: Session;
  // the session is no longer valid: ask for a name again
  onSessionLost: () => void;
  // the player left on purpose
  onLeft: () => void;
}

/**
 * Render a room the player is in.
 *
 * @param {RoomViewProps} props The room, the identity and the exits.
 *
 * @returns {JSX.Element} The room screen.
 */
export function RoomView({
  code,
  session,
  onSessionLost,
  onLeft,
}: RoomViewProps) {

  const navigate = useNavigate();
  const connection = useRoomConnection(code, session);
  const { status, room, error } = connection;
  const notices = useRoomNotices(room, session.playerId);

  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const sessionLost = status === 'failed'
    && error === 'invalid_player_token_error';

  // removed from the room while away: back to the invite screen
  useEffect(() => {
    if (sessionLost) {
      onSessionLost();
    }
  }, [sessionLost, onSessionLost]);

  /**
   * Leave the room and go home.
   *
   * @returns {Promise<void>}
   */
  async function handleLeave(): Promise<void> {

    setLeaving(true);
    setLeaveError(null);

    // left: forget the room
    try {
      await connection.leave();
      onLeft();

    // still in: say why
    } catch (reason) {
      setLeaveError(describeUnknownError(reason));
      setLeaving(false);
    }
  }

  const goHome = (
    <Button variant="secondary" onClick={() => navigate('/')}>
      Back to home
    </Button>
  );

  if (sessionLost) {
    return null;
  }

  if (status === 'failed') {
    return error === 'room_not_found_error'
      ? (
        <Notice title="This room was closed" actions={goHome}>
          Everyone left and the room closed. How about creating another one?
        </Notice>
      )
      : (
        <Notice title="Oops!" actions={goHome}>
          Could not join the room.
        </Notice>
      );
  }

  if (status === 'replaced') {
    return (
      <Notice
        title="Open in another tab"
        actions={(
          <>
            <Button onClick={connection.reconnect}>Use here</Button>
            {goHome}
          </>
        )}
      >
        You opened this room somewhere else, so this tab was disconnected.
      </Notice>
    );
  }

  if (!room) {
    return (
      <Notice title="Connecting...">
        Joining room <strong>{code}</strong>.
      </Notice>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo size="sm" />
        <div className={styles.leave}>
          <Button
            variant="secondary"
            disabled={leaving}
            onClick={() => void handleLeave()}
          >
            {leaving ? 'Leaving...' : 'Leave room'}
          </Button>
          {leaveError && <p className={styles.error}>{leaveError}</p>}
        </div>
      </header>

      <main className={styles.main}>
        <Lobby room={room} selfId={session.playerId} />
      </main>

      <ToastStack toasts={notices.toasts} onDismiss={notices.dismiss} />

      <AnimatePresence>
        {status === 'reconnecting' && (
          <motion.div
            className={styles.banner}
            role="status"
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            exit={{ y: -80 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          >
            Connection lost, reconnecting...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
