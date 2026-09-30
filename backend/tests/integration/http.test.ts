/**
 * Http api: rooms, health and the error envelope.
 */

// --- IMPORTS ---
import { request } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('rooms', () => {

  it('creates a room with the caller as host, trimming the name', async () => {
    const server = await startServer();

    const { status, body } = await request(server, 'POST', '/api/rooms', {
      name: '  Ana  ',
    });

    expect(status).toBe(201);
    expect(body.room.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(body.room.players).toEqual([
      { id: body.player.id, name: 'Ana', isHost: true },
    ]);
    expect(body.player.token).toEqual(expect.any(String));
  });

  it('finds a room by code in any case, without tokens', async () => {
    const server = await startServer();
    const created = await request(server, 'POST', '/api/rooms', { name: 'A' });
    const code = created.body.room.code;

    const { status, body } = await request(
      server,
      'GET',
      `/api/rooms/${code.toLowerCase()}`,
    );

    expect(status).toBe(200);
    expect(body.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain(created.body.player.token);
  });

  it('joins a room as a new player', async () => {
    const server = await startServer();
    const created = await request(server, 'POST', '/api/rooms', { name: 'A' });

    const { status, body } = await request(
      server,
      'POST',
      `/api/rooms/${created.body.room.code}/join`,
      { name: 'B' },
    );

    expect(status).toBe(200);
    expect(body.room.players.map((p: any) => p.name)).toEqual(['A', 'B']);
    expect(body.player.id).not.toBe(created.body.player.id);
  });

  it('refuses the 21st player', async () => {
    const server = await startServer();
    const created = await request(server, 'POST', '/api/rooms', { name: 'A' });
    const path = `/api/rooms/${created.body.room.code}/join`;

    for (let i = 0; i < 19; i++) {
      await request(server, 'POST', path, { name: `P${i}` });
    }

    const { status, body } = await request(server, 'POST', path, {
      name: 'Extra',
    });

    expect(status).toBe(409);
    expect(body.error).toBe('room_full_error');
  });

  it('answers 404 for an unknown room', async () => {
    const server = await startServer();

    const { status, body } = await request(
      server,
      'POST',
      '/api/rooms/ZZZZZ/join',
      { name: 'A' },
    );

    expect(status).toBe(404);
    expect(body).toEqual({
      error: 'room_not_found_error',
      message: 'Room not found!',
    });
  });

  it.each([
    [{ name: '   ' }, 'name: Too small'],
    [{ name: 'x'.repeat(21) }, 'name: Too big'],
    [{}, 'name: Invalid input'],
  ])('refuses the body %j with a field list', async (body, reason) => {
    const server = await startServer();

    const response = await request(server, 'POST', '/api/rooms', body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('request_validation_error');
    expect(response.body.message[0]).toContain(reason);
  });
});

describe('error envelope', () => {

  it('answers unknown routes with http_error', async () => {
    const server = await startServer();

    const { status, body } = await request(server, 'GET', '/api/nope');

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'http_error', message: 'Not Found' });
  });

  it('answers malformed json with http_error', async () => {
    const server = await startServer();

    const response = await fetch(`${server.url}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{oops',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('http_error');
  });
});

describe('misc', () => {

  it('reports health', async () => {
    const server = await startServer();

    expect(await request(server, 'GET', '/api/health')).toEqual({
      status: 200,
      body: { status: 'ok' },
    });
  });

  it('serves nothing outside the api prefix', async () => {
    const server = await startServer();

    expect((await request(server, 'GET', '/health')).status).toBe(404);
  });
});
