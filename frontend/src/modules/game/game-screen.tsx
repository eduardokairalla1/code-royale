/**
 * Round screens: loaded on demand, only once a room leaves the lobby.
 */

// --- IMPORTS ---
import type { Room } from '../room/room.types.ts';
import type { Draft } from './game.types.ts';
import { findResult } from './game.utils.ts';
import { Match } from './match.tsx';
import { Results } from './results.tsx';
import { Spectator } from './spectator.tsx';

// --- CODE ---
/**
 * Props of the game screen.
 */
export interface GameScreenProps {
  room: Room;
  selfId: string;
  clockOffset: number;
  send: (event: string, payload?: unknown) => Promise<unknown>;
}

/**
 * Pick the round screen: playing, watching or the results.
 *
 * @param {GameScreenProps} props The room, who is looking, clock and send.
 *
 * @returns {JSX.Element} The round screen.
 */
export function GameScreen({
  room,
  selfId,
  clockOffset,
  send,
}: GameScreenProps) {

  if (room.status === 'FINISHED') {
    return (
      <Results
        room={room}
        selfId={selfId}
        onRestart={async () => {
          await send('game:restart');
        }}
        onLoadCode={async (playerId) => {
          return await send('submission:code', { playerId }) as Draft;
        }}
      />
    );
  }

  // joined mid round: watch until the next one
  if (!findResult(room, selfId)) {
    return <Spectator room={room} selfId={selfId} clockOffset={clockOffset} />;
  }

  // a new round remounts the match, so nothing carries over
  return (
    <Match
      key={room.round?.startedAt}
      room={room}
      selfId={selfId}
      clockOffset={clockOffset}
      send={send}
    />
  );
}
