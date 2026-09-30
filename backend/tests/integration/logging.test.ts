/**
 * Log events: what each flow leaves in the logs.
 */

// --- IMPORTS ---
import { PROGRAMS } from '../helpers/fake-executor.js';
import { createRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import type { TestServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * Every log line the server wrote, parsed.
 */
class LogLines {
  readonly raw: string[] = [];

  /**
   * Keep a line, as the logger writes it.
   *
   * @param {string} line One json line.
   *
   * @returns {void}
   */
  write(line: string): void {
    this.raw.push(line);
  }

  /**
   * The lines of an event that match some fields.
   *
   * @param {string} event The event name.
   * @param {Record<string, unknown>} fields Fields the line must have.
   *
   * @returns {any[]} The matching lines.
   */
  all(event: string, fields: Record<string, unknown> = {}): any[] {

    return this.raw
      .map((line) => JSON.parse(line))
      .filter((line) => line.event === event)
      .filter((line) => {
        return Object.entries(fields).every(([key, value]) => {
          return line[key] === value;
        });
      });
  }

  /**
   * Wait for a line of an event that matches some fields.
   *
   * @param {string} event The event name.
   * @param {Record<string, unknown>} fields Fields the line must have.
   *
   * @returns {Promise<any>} The first matching line.
   *
   * @throws {Error} When none shows up in time.
   */
  async find(
    event: string,
    fields: Record<string, unknown> = {},
  ): Promise<any> {

    const deadline = Date.now() + 3000;

    while (Date.now() < deadline) {
      const [line] = this.all(event, fields);

      if (line) {
        return line;
      }

      await sleep(20);
    }

    throw new Error(`No "${event}" logged with ${JSON.stringify(fields)}`);
  }
}

/**
 * Start a server whose logs the test reads.
 *
 * @returns {Promise<{ server: TestServer, logs: LogLines }>} Both.
 */
async function startLogged(): Promise<{ server: TestServer; logs: LogLines }> {

  const logs = new LogLines();
  const server = await startServer({ logger: true, logStream: logs });

  return { server, logs };
}

describe('logging', () => {

  it('follows a room from its creation to its last socket', async () => {
    const { server, logs } = await startLogged();

    const host = await createRoom(server, 'Host');
    const client = await TestClient.join(server, host);
    const ids = { room_code: host.code, player_id: host.playerId };

    await client.emit('game:start');
    await client.emit('submission:submit', {
      language: 'python',
      code: PROGRAMS.sum,
    });
    await logs.find('round_finished', { reason: 'everyone_judged' });
    await client.emit('room:leave');

    // every line says which build wrote it
    expect(await logs.find('started')).toMatchObject({
      level: 'INFO',
      addresses: [expect.stringMatching(/^127\.0\.0\.1:\d+$/)],
      service: 'backend',
      version: expect.any(String),
      commit: expect.any(String),
    });

    expect(await logs.find('request', ids)).toMatchObject({
      route: '/api/rooms',
      status: 201,
      outcome: 'ok',
      duration_ms: expect.any(Number),
    });

    await logs.find('room_created', ids);
    await logs.find('socket_connected', ids);
    await logs.find('command', { ...ids, command: 'game:start' });
    expect(await logs.find('round_started', ids)).toMatchObject({
      challenge_id: expect.any(String),
      players: 1,
    });

    expect(await logs.find('submission_judged', ids)).toMatchObject({
      auto: false,
      passed: 4,
      total: 4,
      verdict: 'ACCEPTED',
      statuses: { OK: 4 },
      recorded: true,
      executor_ms: expect.any(Number),
    });

    expect(await logs.find('round_finished', {
      room_code: host.code,
    })).toMatchObject({ players: 1, submitted: 1, solved: 1, missing: 0 });

    await logs.find('player_left', { ...ids, reason: 'leave' });
    await logs.find('room_deleted', { room_code: host.code, reason: 'empty' });

    expect(await logs.find('socket', ids)).toMatchObject({
      closed_by: 'leave',
      commands: 3,
      duration_ms: expect.any(Number),
    });

    // the token and the code never reach the logs
    expect(logs.raw.join('\n')).not.toContain(host.token);
    expect(logs.all('submission_judged')[0]).not.toHaveProperty('code');
  });

  it('skips the health check and logs unknown routes as info', async () => {
    const { server, logs } = await startLogged();

    await request(server, 'GET', '/api/health');
    await request(server, 'GET', '/api/nope?secret=1');

    expect(await logs.find('request', { status: 404 })).toMatchObject({
      level: 'INFO',
      path: '/api/nope',
      route: null,
    });
    expect(logs.all('request', { path: '/api/health' })).toHaveLength(0);
    expect(logs.raw.join('\n')).not.toContain('secret=1');
  });

  it('logs a failure at its level, with why', async () => {
    const { server, logs } = await startLogged();

    const host = await createRoom(server, 'Host');
    const client = await TestClient.join(server, host);

    await client.emit('game:start');
    await client.emit('submission:submit', {
      language: 'python',
      code: PROGRAMS.unavailable,
    });

    expect(await logs.find('command', {
      command: 'submission:submit',
    })).toMatchObject({
      level: 'ERROR',
      outcome: 'error',
      error: 'executor_unavailable_error',
    });

    expect(await logs.find('submission_judged')).toMatchObject({
      level: 'ERROR',
      outcome: 'error',
    });

    // a bad token is refused before any connection
    await TestClient.connect(server, { roomCode: host.code, token: 'nope' });

    expect(await logs.find('socket_refused')).toMatchObject({
      level: 'WARN',
      error: 'invalid_player_token_error',
    });
  });
});
