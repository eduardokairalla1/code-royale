/**
 * Log events: what each flow leaves in the logs.
 */

// --- IMPORTS ---
import { createRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { sleep } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import type { TestServer } from '../helpers/test-server.js';
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

  it('logs a request with the room it touched', async () => {
    const { server, logs } = await startLogged();

    const host = await createRoom(server, 'Host');
    const ids = { room_code: host.code, player_id: host.playerId };

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

    // the token never reaches the logs
    expect(logs.raw.join('\n')).not.toContain(host.token);
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
});
