/**
 * Room notices: arrivals, departures and the crown moving.
 */

// --- IMPORTS ---
import { describeRoomChanges } from '../../src/modules/room/room.notices.ts';
import type { Player } from '../../src/modules/room/room.types.ts';
import type { Room } from '../../src/modules/room/room.types.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * Build a room with the given players, hosted by the given one.
 *
 * @param {string[]} names The players' names, also used as ids.
 * @param {string} hostId Who is host.
 *
 * @returns {Room} The room.
 */
function roomWith(names: string[], hostId: string): Room {

  const players: Player[] = names.map((name) => ({
    id: name,
    name,
    isHost: name === hostId,
    connected: true,
  }));

  return { code: 'ABCDE', status: 'LOBBY', hostId, players };
}

describe('describeRoomChanges', () => {

  it('tells about arrivals and departures of others', () => {
    const before = roomWith(['Ana', 'Bia'], 'Ana');
    const after = roomWith(['Ana', 'Caio'], 'Ana');

    expect(describeRoomChanges(before, after, 'Ana')).toEqual([
      { text: 'Caio joined the room' },
      { text: 'Bia left' },
    ]);
  });

  it('never tells the player about themself', () => {
    const before = roomWith(['Ana'], 'Ana');
    const after = roomWith(['Ana', 'Bia'], 'Ana');

    expect(describeRoomChanges(before, after, 'Bia')).toEqual([]);
  });

  it('tells who got the crown', () => {
    const before = roomWith(['Ana', 'Bia', 'Caio'], 'Ana');
    const after = roomWith(['Bia', 'Caio'], 'Bia');

    expect(describeRoomChanges(before, after, 'Caio')).toEqual([
      { text: 'Ana left' },
      { text: 'Bia is the host now', tone: 'crown' },
    ]);
    expect(describeRoomChanges(before, after, 'Bia')).toContainEqual({
      text: 'You are the host now!',
      tone: 'crown',
    });
  });

  it('stays quiet when only the status changed', () => {
    const before = roomWith(['Ana', 'Bia'], 'Ana');
    const after = { ...before, status: 'PLAYING' as const };

    expect(describeRoomChanges(before, after, 'Ana')).toEqual([]);
  });
});
