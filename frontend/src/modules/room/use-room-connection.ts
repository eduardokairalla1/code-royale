/**
 * Live connection to a room: its state and the player's commands.
 */

// --- IMPORTS ---
import { config } from '../../config.ts';
import { ApiError } from '../../shared/errors.ts';
import { isErrorBody } from '../../shared/errors.ts';
import type { Room } from './room.types.ts';
import type { Session } from './room.types.ts';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// --- GLOBALS ---
// how long a command waits for the server's answer
const COMMAND_TIMEOUT_MS = 15_000;

// --- CODE ---
/**
 * Where the connection stands.
 */
export type ConnectionStatus =
  // first connection, no state yet
  | 'connecting'
  | 'connected'
  // dropped, socket.io is trying again on its own
  | 'reconnecting'
  // the same player opened the room somewhere else
  | 'replaced'
  // refused for good, see the error
  | 'failed';

/**
 * What the room connection exposes.
 */
export interface RoomConnection {
  status: ConnectionStatus;
  room: Room | null;
  // backend slug of why the connection was refused
  error: string | null;
  send: (event: string, payload?: unknown) => Promise<unknown>;
  leave: () => Promise<void>;
  reconnect: () => void;
}

/**
 * Connect to a room as the player the session belongs to.
 *
 * @param {string} code The room code.
 * @param {Session} session The player's identity in the room.
 *
 * @returns {RoomConnection} The live room and its commands.
 */
export function useRoomConnection(
  code: string,
  session: Session,
): RoomConnection {

  const socketRef = useRef<Socket | null>(null);
  const leavingRef = useRef(false);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {

    // the origin alone: socket.io reads any path in the url as a namespace
    const socket = io(config.socketOrigin, {
      path: config.socketPath,
      auth: { roomCode: code, token: session.token },
      transports: ['websocket'],
    });

    socketRef.current = socket;
    leavingRef.current = false;

    socket.on('connect', () => {
      setStatus('connected');
      setError(null);
    });

    // every change of the room lands here
    socket.on('room:state', (next: Room) => {
      setRoom(next);
    });

    // refused by the server: for good, socket.io will not retry
    socket.on('connect_error', (reason: Error & { data?: unknown }) => {
      if (isErrorBody(reason.data)) {
        setStatus('failed');
        setError(reason.data.error);
        return;
      }

      // server unreachable: socket.io keeps trying
      setStatus((current) => {
        return current === 'connected' ? 'reconnecting' : current;
      });
    });

    socket.on('disconnect', (reason) => {

      // we asked for it
      if (reason === 'io client disconnect' || leavingRef.current) {
        return;
      }

      // the server dropped this socket: another tab took over
      if (reason === 'io server disconnect') {
        setStatus('replaced');
        return;
      }

      setStatus('reconnecting');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, session.token, attempt]);

  const send = useCallback(async (event: string, payload?: unknown) => {

    const socket = socketRef.current;

    if (!socket?.connected) {
      throw new ApiError('network_error');
    }

    let response: unknown;

    // no answer in time: same as not reaching the server
    try {
      const timed = socket.timeout(COMMAND_TIMEOUT_MS);

      response = payload === undefined
        ? await timed.emitWithAck(event)
        : await timed.emitWithAck(event, payload);
    } catch {
      throw new ApiError('network_error');
    }

    // refused by the server: keep its slug
    if (isErrorBody(response)) {
      throw new ApiError(response.error);
    }

    return (response as { data?: unknown }).data;
  }, []);

  const leave = useCallback(async () => {

    leavingRef.current = true;

    // could not leave: stay, and let the next drop be reported again
    try {
      await send('room:leave');
    } catch (reason) {
      leavingRef.current = false;
      throw reason;
    }
  }, [send]);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    setError(null);
    setAttempt((current) => current + 1);
  }, []);

  return { status, room, error, send, leave, reconnect };
}
