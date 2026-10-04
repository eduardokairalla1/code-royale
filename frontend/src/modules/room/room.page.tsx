/**
 * Room page: the invite screen for newcomers, the room itself for players.
 */

// --- IMPORTS ---
import { JoinRoom } from './join-room.tsx';
import { RoomView } from './room-view.tsx';
import { clearSession } from './room.session.ts';
import { normalizeRoomCode } from './room.session.ts';
import { readSession } from './room.session.ts';
import type { Session } from './room.types.ts';
import { useCallback } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useParams } from 'react-router';

// --- CODE ---
/**
 * Render the room of the url's code.
 *
 * @returns {JSX.Element} The invite screen or the room.
 */
export function RoomPage() {

  const params = useParams();
  const code = normalizeRoomCode(params.code ?? '');

  // remount on another code, so nothing leaks between rooms
  return <RoomEntry key={code} code={code} />;
}

/**
 * Hold the player's identity in one room and swap screens as it changes.
 *
 * @param {object} props The room code.
 * @param {string} props.code The normalized room code.
 *
 * @returns {JSX.Element} The invite screen or the room.
 */
function RoomEntry({ code }: { code: string }) {

  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(
    () => readSession(code),
  );

  // removed from the room while away: ask for a name again
  const handleSessionLost = useCallback(() => {
    clearSession(code);
    setSession(null);
  }, [code]);

  // left on purpose: forget the room and go home
  const handleLeft = useCallback(() => {
    clearSession(code);
    navigate('/');
  }, [code, navigate]);

  if (!session) {
    return <JoinRoom code={code} onJoined={setSession} />;
  }

  return (
    <RoomView
      code={code}
      session={session}
      onSessionLost={handleSessionLost}
      onLeft={handleLeft}
    />
  );
}
