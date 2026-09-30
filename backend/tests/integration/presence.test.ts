/**
 * Presence: connections.
 */

// --- IMPORTS ---
import { createRoom } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('connecting', () => {

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
