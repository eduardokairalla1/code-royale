/**
 * Configured limits.
 */

// --- IMPORTS ---
import { createRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
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
