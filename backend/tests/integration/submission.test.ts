/**
 * Running the code against the examples.
 */

// --- IMPORTS ---
import { PROGRAMS } from '../helpers/fake-executor.js';
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * A running round with the given players connected, the first one hosting.
 *
 * @param {string[]} names The players' names.
 *
 * @returns The server and one client per name.
 */
async function roundWith(names: string[]) {

  const server = await startServer();
  const host = await createRoom(server, names[0] ?? 'Host');
  const identities = [host];

  for (const name of names.slice(1)) {
    identities.push(await joinRoom(server, host.code, name));
  }

  const clients = await Promise.all(
    identities.map((identity) => TestClient.join(server, identity)),
  );

  const hostClient = clients[0] as TestClient;

  await hostClient.waitFor((room) => room.players.every((p) => p.connected));
  await hostClient.emit('game:start');
  await hostClient.waitFor((room) => room.status === 'PLAYING');

  return { server, host, clients };
}

/**
 * A payload to run or submit a fake program.
 *
 * @param {string} code The fake program.
 *
 * @returns {{ language: string, code: string }} The payload.
 */
function program(code: string): { language: string; code: string } {
  return { language: 'python', code };
}

describe('running the examples', () => {

  it('returns each example with its output', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', program(PROGRAMS.sum));

    expect(response).toEqual({
      ok: true,
      data: [{
        input: '2 5',
        expectedOutput: '7',
        stdout: '7\n',
        stderr: '',
        status: 'OK',
        passed: true,
      }],
    });
  });

  it.each([
    ['print:8', 'WRONG_ANSWER'],
    [PROGRAMS.compileError, 'COMPILE_ERROR'],
    [PROGRAMS.crash, 'RUNTIME_ERROR'],
    [PROGRAMS.timeout, 'TIME_LIMIT'],
  ])('reports %s as %s', async (code, status) => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', program(code));

    expect(response.data[0].status).toBe(status);
    expect(response.data[0].passed).toBe(false);
  });

  it('allows one run at a time per player', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const responses = await Promise.all([
      ana!.emit('submission:run', program(PROGRAMS.slowSum)),
      ana!.emit('submission:run', program(PROGRAMS.slowSum)),
    ]);

    expect(responses.map((r) => r.ok ?? r.error).sort())
      .toEqual(['run_in_progress_error', true]);
  });

  it.each([
    [{ language: 'cobol', code: 'x' }],
    [{ language: 'python', code: '   ' }],
    ['not an object'],
  ])('refuses the payload %j', async (payload) => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', payload);

    expect(response.error).toBe('request_validation_error');
  });

  it('refuses a player who joined mid round', async () => {
    const { server, host } = await roundWith(['Ana']);
    const late = await joinRoom(server, host.code, 'Late');
    const lateClient = await TestClient.join(server, late);

    const response = await lateClient.emit(
      'submission:run',
      program(PROGRAMS.sum),
    );

    expect(response.error).toBe('not_in_round_error');
  });
});
