/**
 * Presence: connections, reconnections, host hand-over and expiry.
 */

// --- IMPORTS ---
import type { PublicRoom } from '../../src/modules/room/room.types.js';
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TEST_TIMINGS } from '../helpers/test-server.js';
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

  it('keeps a player who comes back within the grace period', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const bob = await joinRoom(server, ana.code, 'Bob');
    const anaClient = await TestClient.join(server, ana);
    const bobClient = await TestClient.join(server, bob);

    bobClient.socket.disconnect();
    await anaClient.waitFor((room) => roster(room) === 'Ana*+,Bob-');

    await TestClient.join(server, bob);
    anaClient.clear();
    await sleep(TEST_TIMINGS.reconnectGraceMs * 2);

    expect(roster(anaClient.state ?? await anaClient.waitFor(() => true)))
      .toBe('Ana*+,Bob+');
  });

  it('removes a player after the grace period', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const bob = await joinRoom(server, ana.code, 'Bob');
    const anaClient = await TestClient.join(server, ana);
    const bobClient = await TestClient.join(server, bob);

    bobClient.socket.disconnect();
    await anaClient.waitFor((room) => roster(room) === 'Ana*+');

    const again = await TestClient.join(server, bob);

    expect(again.connectError?.error).toBe('invalid_player_token_error');
  });
});

describe('leaving', () => {

  it('hands the host over to the oldest connected player', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const bob = await joinRoom(server, ana.code, 'Bob');
    const anaClient = await TestClient.join(server, ana);
    const bobClient = await TestClient.join(server, bob);

    expect(await anaClient.emit('room:leave')).toEqual({ ok: true });
    await bobClient.waitFor((room) => roster(room) === 'Bob*+');
    await sleep(50);

    expect(anaClient.disconnectReason).toBe('io server disconnect');
  });
});

describe('empty rooms', () => {

  it('keeps a room nobody is connected to until the ttl', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const client = await TestClient.join(server, ana);

    client.socket.disconnect();
    await sleep(TEST_TIMINGS.emptyRoomTtlMs / 3);

    const during = await request(server, 'GET', `/api/rooms/${ana.code}`);
    expect(during.status).toBe(200);

    await sleep(TEST_TIMINGS.emptyRoomTtlMs);

    const after = await request(server, 'GET', `/api/rooms/${ana.code}`);
    expect(after.status).toBe(404);
  });

  it('lets a player back into an empty room within the ttl', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');
    const first = await TestClient.join(server, ana);

    first.socket.disconnect();
    await sleep(TEST_TIMINGS.emptyRoomTtlMs / 3);

    const back = await TestClient.join(server, ana);

    expect(back.connectError).toBeNull();
    expect(roster(await back.waitFor(() => true))).toBe('Ana*+');
  });

  it('deletes a room whose host never connected', async () => {
    const server = await startServer();
    const ana = await createRoom(server, 'Ana');

    await sleep(TEST_TIMINGS.emptyRoomTtlMs * 1.5);

    const { status } = await request(server, 'GET', `/api/rooms/${ana.code}`);
    expect(status).toBe(404);
  });
});
