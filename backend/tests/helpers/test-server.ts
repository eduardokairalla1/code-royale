/**
 * Test harness: a real server on a random port.
 */

// --- IMPORTS ---
import type { AppOptions } from '../../src/app.js';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import { afterEach } from 'vitest';

// --- GLOBALS ---
// everything opened by a test, closed after it
const openServers: TestServer[] = [];

// --- CODE ---
/**
 * A player's identity, as the http api hands it out.
 */
export interface Identity {
  code: string;
  playerId: string;
  token: string;
}

/**
 * A running server.
 */
export interface TestServer {
  app: FastifyInstance;
  url: string;
}

/**
 * Start a server without logs.
 *
 * @param {AppOptions} options Overrides for the test defaults.
 *
 * @returns {Promise<TestServer>} The running server.
 */
export async function startServer(
  options: AppOptions = {},
): Promise<TestServer> {

  const app = buildApp({
    logger: false,
    ...options,
  });

  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const server = { app, url: `http://127.0.0.1:${port}` };

  openServers.push(server);

  return server;
}

/**
 * Call the http api.
 *
 * @param {TestServer} server The server.
 * @param {string} method The http method.
 * @param {string} path The path, e.g. "/rooms".
 * @param {unknown} body The json body, if any.
 *
 * @returns {Promise<{ status: number, body: any }>} The status and body.
 */
export async function request(
  server: TestServer,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {

  const response = await fetch(server.url + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
}

/**
 * Create a room through the http api.
 *
 * @param {TestServer} server The server.
 * @param {string} name The host's name.
 *
 * @returns {Promise<Identity>} The room code and the host's identity.
 */
export async function createRoom(
  server: TestServer,
  name: string,
): Promise<Identity> {

  const { body } = await request(server, 'POST', '/api/rooms', { name });

  return { code: body.room.code, ...toIdentity(body) };
}

/**
 * Take the player's id and token out of a join response.
 *
 * @param {any} body The response body.
 *
 * @returns {{ playerId: string, token: string }} The identity.
 */
function toIdentity(body: any): { playerId: string; token: string } {
  return { playerId: body.player.id, token: body.player.token };
}

/**
 * Wait for a while.
 *
 * @param {number} ms How long.
 *
 * @returns {Promise<void>}
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// close whatever each test opened
afterEach(async () => {
  await Promise.all(openServers.splice(0).map(({ app }) => app.close()));
});
