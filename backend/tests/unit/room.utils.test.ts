/**
 * Room helpers: public views, host hand-over and room codes.
 */

// --- IMPORTS ---
import type { Player } from '../../src/modules/room/room.types.js';
import type { Room } from '../../src/modules/room/room.types.js';
import { createPlayer } from '../../src/modules/room/room.utils.js';
import { hasConnectedPlayers } from '../../src/modules/room/room.utils.js';
import { normalizeRoomCode } from '../../src/modules/room/room.utils.js';
import { pickNextHost } from '../../src/modules/room/room.utils.js';
import { toPublicRoom } from '../../src/modules/room/room.utils.js';
import { generateRoomCode } from '../../src/shared/ids.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * Build a room with the given players, in join order.
 *
 * @param {Player[]} players The players.
 *
 * @returns {Room} The room, hosted by the first player.
 */
function roomWith(players: Player[]): Room {
  return {
    code: 'ABCDE',
    hostId: players[0]?.id ?? '',
    status: 'LOBBY',
    players: new Map(players.map((player) => [player.id, player])),
    round: null,
    playedChallengeIds: [],
    difficulties: ['easy', 'medium', 'hard'],
    createdAt: 0,
    version: 0,
  };
}

/**
 * Build a player, connected or not.
 *
 * @param {string} name The player's name.
 * @param {boolean} connected Whether they have a socket.
 *
 * @returns {Player} The player.
 */
function player(name: string, connected: boolean): Player {
  return { ...createPlayer(name), socketId: connected ? `s-${name}` : null };
}

describe('toPublicRoom', () => {

  it('never exposes tokens or socket ids', () => {
    const ana = player('Ana', true);
    const json = JSON.stringify(toPublicRoom(roomWith([ana])));

    expect(json).not.toContain(ana.token);
    expect(json).not.toContain('s-Ana');
  });

  it('flags the host and who is connected', () => {
    const room = roomWith([player('Ana', true), player('Bob', false)]);

    expect(toPublicRoom(room).players.map((p) => [p.isHost, p.connected]))
      .toEqual([[true, true], [false, false]]);
  });
});

describe('pickNextHost', () => {

  it('prefers the oldest connected player', () => {
    const room = roomWith([player('Ana', false), player('Bob', true)]);

    expect(pickNextHost(room)?.name).toBe('Bob');
  });

  it('falls back to the oldest player when nobody is connected', () => {
    const room = roomWith([player('Ana', false), player('Bob', false)]);

    expect(pickNextHost(room)?.name).toBe('Ana');
  });

  it('returns nobody for an empty room', () => {
    expect(pickNextHost(roomWith([]))).toBeUndefined();
  });
});

describe('hasConnectedPlayers', () => {

  it('tells whether anyone has a socket', () => {
    expect(hasConnectedPlayers(roomWith([player('Ana', false)]))).toBe(false);
    expect(hasConnectedPlayers(roomWith([player('Ana', true)]))).toBe(true);
  });
});

describe('room codes', () => {

  it('are 5 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    }
  });

  it('match whatever case the player typed', () => {
    expect(normalizeRoomCode(' x7k2p ')).toBe('X7K2P');
  });
});
