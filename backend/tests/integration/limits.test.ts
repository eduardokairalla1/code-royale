/**
 * Configured limits and the socket event rate.
 */

// --- IMPORTS ---
import { createRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('enabled languages', () => {

  it('lists only the enabled languages', async () => {
    const server = await startServer({
      enabledLanguages: ['python', 'javascript'],
    });

    const { body } = await request(server, 'GET', '/api/languages');

    expect(body.map((language: any) => language.id))
      .toEqual(['python', 'javascript']);
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
