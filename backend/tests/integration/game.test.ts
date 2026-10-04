/**
 * Round lifecycle: start, clock, late joiners, play again.
 */

// --- IMPORTS ---
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
 * A server with a connected host and one connected guest.
 *
 * @returns The server and both clients.
 */
async function roomWithTwo() {

  const server = await startServer();
  const host = await createRoom(server, 'Host');
  const guest = await joinRoom(server, host.code, 'Guest');
  const hostClient = await TestClient.join(server, host);
  const guestClient = await TestClient.join(server, guest);

  // both connected before anything starts
  await hostClient.waitFor((room) => room.players.every((p) => p.connected));

  return { server, host, hostClient, guestClient };
}

describe('starting', () => {

  it('lets only the host start, from the lobby', async () => {
    const { hostClient, guestClient } = await roomWithTwo();

    expect((await guestClient.emit('game:start')).error)
      .toBe('not_host_error');
    expect(await hostClient.emit('game:start')).toEqual({ ok: true });
    expect((await hostClient.emit('game:start')).error)
      .toBe('game_already_started_error');
  });

  it('sends the round without the hidden tests', async () => {
    const { hostClient, guestClient } = await roomWithTwo();

    await hostClient.emit('game:start');
    const room = await guestClient.waitFor((r) => r.status === 'PLAYING');

    expect(room.round?.challenge.examples).toHaveLength(1);
    expect(room.round?.endsAt).toBe(
      (room.round?.startedAt ?? 0) + TEST_TIMINGS.roundMs,
    );
    expect(room.round?.results).toHaveLength(2);
    expect(JSON.stringify(guestClient.states)).not.toContain('999999');
  });
});

describe('late joiners', () => {

  it('can join mid round and wait for the next one', async () => {
    const { server, host, hostClient } = await roomWithTwo();

    await hostClient.emit('game:start');

    const late = await joinRoom(server, host.code, 'Late');
    const lateClient = await TestClient.join(server, late);
    const room = await lateClient.waitFor((r) => r.status === 'PLAYING');

    expect(room.players.map((p) => p.name)).toContain('Late');
    expect(room.round?.results.map((r) => r.playerId))
      .not.toContain(late.playerId);
  });
});

describe('the clock', () => {

  it('ends the round on time and keeps disconnected players', async () => {
    const { hostClient, guestClient } = await roomWithTwo();

    await hostClient.emit('game:start');
    guestClient.socket.disconnect();

    // past the grace period, still mid round: the guest is kept
    await sleep(TEST_TIMINGS.reconnectGraceMs * 2);
    expect(hostClient.state?.players).toHaveLength(2);

    const finished = await hostClient.waitFor(
      (room) => room.status === 'FINISHED',
    );

    expect(finished.round?.results).toHaveLength(2);

    // round over: the grace period applies again
    await hostClient.waitFor((room) => room.players.length === 1);
  });
});

describe('playing again', () => {

  it('goes back to the same lobby and avoids repeats', async () => {
    const { server, host, hostClient, guestClient } = await roomWithTwo();

    expect((await hostClient.emit('game:restart')).error)
      .toBe('game_not_finished_error');

    await hostClient.emit('game:start');
    const first = await hostClient.waitFor((r) => r.status === 'PLAYING');
    await hostClient.waitFor((r) => r.status === 'FINISHED');

    expect((await guestClient.emit('game:restart')).error)
      .toBe('not_host_error');
    expect(await hostClient.emit('game:restart')).toEqual({ ok: true });

    const lobby = await guestClient.waitFor((r) => r.status === 'LOBBY');
    expect(lobby.round).toBeNull();
    expect(lobby.players).toHaveLength(2);

    hostClient.clear();
    await hostClient.emit('game:start');
    const second = await hostClient.waitFor((r) => r.status === 'PLAYING');

    expect(second.round?.challenge.id).not.toBe(first.round?.challenge.id);

    const http = await request(server, 'GET', `/api/rooms/${host.code}`);
    expect(http.body.round.challenge.id).toBe(second.round?.challenge.id);
  });
});
