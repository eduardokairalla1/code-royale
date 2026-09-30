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
