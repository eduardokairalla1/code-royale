/**
 * Notices on who came, left or became host, from two room states.
 */

// --- IMPORTS ---
import type { Toast } from '../../components/toast/toast-stack.tsx';
import type { Room } from './room.types.ts';
import { useCallback } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// ids for the notices, unique for the page's lifetime
let nextToastId = 1;

// --- CODE ---
/**
 * A notice, before it gets an id.
 */
export type Notice = Omit<Toast, 'id'>;

/**
 * Describe what changed between two states of a room.
 *
 * @param {Room} previous The state before.
 * @param {Room} next The state after.
 * @param {string} selfId Who is looking: never told about themself.
 *
 * @returns {Notice[]} One notice per change worth telling.
 */
export function describeRoomChanges(
  previous: Room,
  next: Room,
  selfId: string,
): Notice[] {

  const notices: Notice[] = [];
  const before = new Map(previous.players.map((player) => [player.id, player]));
  const after = new Map(next.players.map((player) => [player.id, player]));

  // arrivals
  for (const player of next.players) {
    if (!before.has(player.id) && player.id !== selfId) {
      notices.push({ text: `${player.name} joined the room` });
    }
  }

  // departures
  for (const player of previous.players) {
    if (!after.has(player.id) && player.id !== selfId) {
      notices.push({ text: `${player.name} left` });
    }
  }

  // the crown moved
  if (previous.hostId !== next.hostId) {
    const host = after.get(next.hostId);

    if (next.hostId === selfId) {
      notices.push({ text: 'You are the host now!', tone: 'crown' });
    } else if (host) {
      notices.push({ text: `${host.name} is the host now`, tone: 'crown' });
    }
  }

  return notices;
}

/**
 * Turn room changes into notices as states arrive.
 *
 * @param {Room | null} room The latest room state.
 * @param {string} selfId Who is looking.
 *
 * @returns {{ toasts: Toast[], dismiss: (id: number) => void }} The notices
 *          on screen and how to drop one.
 */
export function useRoomNotices(
  room: Room | null,
  selfId: string,
): { toasts: Toast[]; dismiss: (id: number) => void } {

  const [previous, setPrevious] = useState(room);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // a new state: compare it with the last one, while rendering
  if (room !== previous) {
    setPrevious(room);

    if (previous && room) {
      const notices = describeRoomChanges(previous, room, selfId);

      if (notices.length > 0) {
        setToasts((current) => [
          ...current,
          ...notices.map((notice) => ({ ...notice, id: nextToastId++ })),
        ]);
      }
    }
  }

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, dismiss };
}
