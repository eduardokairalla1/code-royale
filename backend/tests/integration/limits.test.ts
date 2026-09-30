/**
 * Configured limits and the socket event rate.
 */

// --- IMPORTS ---
import { PROGRAMS } from '../helpers/fake-executor.js';
import { createRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * A running round with a single connected player.
 *
 * @param {Parameters<typeof startServer>[0]} options Server overrides.
 *
 * @returns {Promise<TestClient>} The player's client.
 */
async function soloRound(
  options: Parameters<typeof startServer>[0],
): Promise<TestClient> {

  const server = await startServer(options);
  const host = await createRoom(server, 'Ana');
  const client = await TestClient.join(server, host);

  await client.waitFor((room) => room.players.every((p) => p.connected));
  await client.emit('game:start');
  await client.waitFor((room) => room.status === 'PLAYING');

  return client;
}

describe('enabled languages', () => {

  it('lists only the enabled languages', async () => {
    const server = await startServer({
      enabledLanguages: ['python', 'javascript'],
    });

    const { body } = await request(server, 'GET', '/api/languages');

    expect(body.map((language: any) => language.id))
      .toEqual(['python', 'javascript']);
  });

  it('refuses code in a disabled language', async () => {
    const client = await soloRound({ enabledLanguages: ['python'] });

    const refused = await client.emit('submission:run', {
      language: 'rust',
      code: PROGRAMS.sum,
    });
    const accepted = await client.emit('submission:run', {
      language: 'python',
      code: PROGRAMS.sum,
    });

    expect(refused.error).toBe('request_validation_error');
    expect(accepted.ok).toBe(true);
  });
});

describe('code size', () => {

  it('refuses code longer than the limit', async () => {
    const client = await soloRound({ maxCodeLength: 10 });

    const response = await client.emit('submission:run', {
      language: 'python',
      code: `${PROGRAMS.sum}${' '.repeat(10)}`,
    });

    expect(response.error).toBe('request_validation_error');
    expect(response.message[0]).toContain('code: Too big');
  });
});

describe('players per room', () => {

  it('refuses players past the limit', async () => {
    const server = await startServer({ maxPlayersPerRoom: 2 });
    const host = await createRoom(server, 'Ana');
    const path = `/api/rooms/${host.code}/join`;

    const second = await request(server, 'POST', path, { name: 'Bob' });
    const third = await request(server, 'POST', path, { name: 'Caio' });

    expect(second.status).toBe(200);
    expect(third.body.error).toBe('room_full_error');
  });
});

describe('rooms', () => {

  it('refuses new rooms past the limit', async () => {
    const server = await startServer({ maxRooms: 1 });

    const first = await request(server, 'POST', '/api/rooms', { name: 'Ana' });
    const second = await request(server, 'POST', '/api/rooms', { name: 'Bob' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(503);
    expect(second.body.error).toBe('too_many_rooms_error');
  });
});

describe('socket events', () => {

  it('answers events past the rate with an error', async () => {
    const server = await startServer();
    const host = await createRoom(server, 'Ana');
    const client = await TestClient.join(server, host);
    const answers: any[] = [];

    // a burst far above the editor's pace; only refusals are answered
    for (let i = 0; i < 40; i++) {
      client.socket.emit('noop', (answer: any) => answers.push(answer));
    }

    await sleep(200);

    expect(answers.length).toBeGreaterThan(0);
    expect(answers.every((answer) => answer.error === 'rate_limited_error'))
      .toBe(true);
  });
});
