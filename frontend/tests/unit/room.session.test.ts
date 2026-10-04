/**
 * What the browser remembers about the player and their rooms.
 */

// --- IMPORTS ---
import { clearSession } from '../../src/modules/room/room.session.ts';
import { normalizeRoomCode } from '../../src/modules/room/room.session.ts';
import { readPlayerName } from '../../src/modules/room/room.session.ts';
import { readSession } from '../../src/modules/room/room.session.ts';
import { savePlayerName } from '../../src/modules/room/room.session.ts';
import { saveSession } from '../../src/modules/room/room.session.ts';
import type { JoinResponse } from '../../src/modules/room/room.types.ts';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- GLOBALS ---
const RESPONSE: JoinResponse = {
  room: {
    code: 'X7K2P',
    status: 'LOBBY',
    hostId: 'p1',
    players: [],
    round: null,
    difficulties: ['easy', 'medium', 'hard'],
    version: 1,
  },
  player: { id: 'p1', token: 'secret' },
};

// --- CODE ---
/**
 * A browser storage kept in memory.
 *
 * @returns {Storage} The storage.
 */
function memoryStorage(): Storage {

  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('room session', () => {

  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers the identity of a room, whatever the code case', () => {
    saveSession(RESPONSE);

    expect(readSession('x7k2p')).toEqual({ playerId: 'p1', token: 'secret' });
  });

  it('forgets a room on request', () => {
    saveSession(RESPONSE);
    clearSession('X7K2P');

    expect(readSession('X7K2P')).toBeNull();
  });

  it('remembers the name for the next visit', () => {
    expect(readPlayerName()).toBe('');

    savePlayerName('Lucas');

    expect(readPlayerName()).toBe('Lucas');
  });

  it('behaves as empty when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked');
      },
    });

    expect(() => saveSession(RESPONSE)).not.toThrow();
    expect(readSession('X7K2P')).toBeNull();
  });

  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' x7k2p ')).toBe('X7K2P');
  });
});
