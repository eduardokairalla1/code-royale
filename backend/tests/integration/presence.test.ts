/**
 * Presence: connections, reconnections and leaving.
 */

// --- IMPORTS ---
import type { PublicRoom } from '../../src/modules/room/room.types.js';
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * Summarize who is in a room, e.g. "Ana*+,Bob-": * host, + connected.
 *
 * @param {PublicRoom} room The room.
 *
 * @returns {string} One entry per player, in join order.
 */
function roster(room: PublicRoom): string {
  return room.players
    .map((p) => `${p.name}${p.isHost ? '*' : ''}${p.connected ? '+' : '-'}`)
    .join(',');
}

describe('connecting', () => {

  it('pushes the room to everyone as players connect', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const anaClient = await TestClient.join(server, ana);

    await anaClient.waitFor((room) => roster(room) === 'Ana*+');

    const bob = await joinRoom(server, ana.code, 'Bob');
    await anaClient.waitFor((room) => roster(room) === 'Ana*+,Bob-');

    await TestClient.join(server, bob);
    await anaClient.waitFor((room) => roster(room) === 'Ana*+,Bob+');
  });

  it('never broadcasts tokens', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const client = await TestClient.join(server, ana);

    await client.waitFor(() => true);

    expect(JSON.stringify(client.states)).not.toContain(ana.token);
  });

  it.each([
    ['a wrong token', { token: 'nope' }, 'invalid_player_token_error'],
    ['an unknown room', { roomCode: 'ZZZZZ' }, 'room_not_found_error'],
    ['no auth at all', null, 'request_validation_error'],
  ])('refuses %s', async (_, override, error) => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');

    const auth = override === null
      ? {}
      : { roomCode: ana.code, token: ana.token, ...override };

    const client = await TestClient.connect(server, auth);

    expect(client.connectError?.error).toBe(error);
  });
});

describe('reconnecting', () => {

  it('drops the old tab when the same player connects again', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const oldTab = await TestClient.join(server, ana);
    const newTab = await TestClient.join(server, ana);

    await sleep(100);

    expect(oldTab.disconnectReason).toBe('io server disconnect');
    expect(roster(await newTab.waitFor(() => true))).toBe('Ana*+');
  });
});

describe('leaving', () => {

  it('removes the player and closes their socket', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const bob = await joinRoom(server, ana.code, 'Bob');
    const anaClient = await TestClient.join(server, ana);
    const bobClient = await TestClient.join(server, bob);

    expect(await bobClient.emit('room:leave')).toEqual({ ok: true });
    await anaClient.waitFor((room) => roster(room) === 'Ana*+');
    await sleep(50);

    expect(bobClient.disconnectReason).toBe('io server disconnect');
  });
});
