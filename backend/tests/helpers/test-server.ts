/**
 * Test harness: a real server on a random port and socket clients.
 */

// --- IMPORTS ---
import type { AppOptions } from '../../src/app.js';
import { buildApp } from '../../src/app.js';
import {
  ChallengeService,
} from '../../src/modules/challenge/challenge.service.js';
import type { PublicRoom } from '../../src/modules/room/room.types.js';
import type { CommandResponse } from '../../src/shared/socket-command.js';
import { SOCKET_PATH } from '../../src/socket.js';
import { FakeExecutor } from './fake-executor.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterAll } from 'vitest';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';

// --- GLOBALS ---
const FIXTURES = new URL('../fixtures/challenges/', import.meta.url);

// short timers, so tests do not wait for the production ones
export const TEST_TIMINGS = {
  emptyRoomTtlMs: 600,
  reconnectGraceMs: 300,
  // fixture challenges last 2 seconds
  roundMs: 2000,
  schedulerPollMs: 20,
  judgeTimeoutMs: 2000,
};

// every server of a test shares its keys, as instances of one deployment
let keyPrefix = '';

// cleans the keys up after each test
const redis = createClient({ url: process.env.REDIS_URL as string });

// everything opened by a test, closed after it
const openServers: TestServer[] = [];
const openClients: TestClient[] = [];

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
 * A running server and the fake sandbox behind it.
 */
export interface TestServer {
  app: FastifyInstance;
  url: string;
  executor: FakeExecutor;
}

/**
 * Start a server with fake execution, fixture challenges, short timers.
 *
 * @param {AppOptions} options Overrides for the test defaults.
 *
 * @returns {Promise<TestServer>} The running server.
 */
export async function startServer(
  options: AppOptions = {},
): Promise<TestServer> {

  const executor = new FakeExecutor();

  const app = buildApp({
    logger: false,
    executor,
    challengeService: ChallengeService.load(FIXTURES),
    emptyRoomTtlMs: TEST_TIMINGS.emptyRoomTtlMs,
    reconnectGraceMs: TEST_TIMINGS.reconnectGraceMs,
    schedulerPollMs: TEST_TIMINGS.schedulerPollMs,
    judgeTimeoutMs: TEST_TIMINGS.judgeTimeoutMs,
    redisKeyPrefix: keyPrefix,
    ...options,
  });

  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const server = { app, url: `http://127.0.0.1:${port}`, executor };

  openServers.push(server);

  return server;
}

/**
 * The key prefix of the running test, shared by all of its servers.
 *
 * @returns {string} The prefix.
 */
export function testKeyPrefix(): string {
  return keyPrefix;
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
 * Join a room through the http api.
 *
 * @param {TestServer} server The server.
 * @param {string} code The room code.
 * @param {string} name The player's name.
 *
 * @returns {Promise<Identity>} The room code and the player's identity.
 */
export async function joinRoom(
  server: TestServer,
  code: string,
  name: string,
): Promise<Identity> {

  const { body } = await request(server, 'POST', `/api/rooms/${code}/join`, {
    name,
  });

  return { code, ...toIdentity(body) };
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
 * A socket client that records every room state it receives.
 */
export class TestClient {
  readonly states: PublicRoom[] = [];
  connectError: any = null;
  disconnectReason: string | null = null;

  /**
   * Wrap a socket, recording its events.
   *
   * @param {Socket} socket The socket.io client socket.
   */
  private constructor(readonly socket: Socket) {
    socket.on('room:state', (room: PublicRoom) => this.states.push(room));
    socket.on('connect_error', (error: any) => {
      this.connectError = error.data;
    });
    socket.on('disconnect', (reason) => {
      this.disconnectReason = reason;
    });
  }

  /**
   * Connect to the server and wait until it accepts or refuses.
   *
   * @param {TestServer} server The server.
   * @param {unknown} auth The handshake auth, usually a room code and token.
   *
   * @returns {Promise<TestClient>} The client, connected or refused.
   */
  static async connect(server: TestServer, auth: unknown): Promise<TestClient> {

    const socket = io(server.url, {
      path: SOCKET_PATH,
      auth: auth as Record<string, unknown>,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    const client = new TestClient(socket);

    openClients.push(client);

    await new Promise<void>((resolve) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', () => resolve());
    });

    return client;
  }

  /**
   * Connect as a player of a room.
   *
   * @param {TestServer} server The server.
   * @param {Identity} identity The player's room code and token.
   *
   * @returns {Promise<TestClient>} The connected client.
   */
  static async join(
    server: TestServer,
    identity: Identity,
  ): Promise<TestClient> {
    return TestClient.connect(server, {
      roomCode: identity.code,
      token: identity.token,
    });
  }

  /**
   * The last room state received.
   *
   * @returns {PublicRoom | undefined} The state, if any arrived.
   */
  get state(): PublicRoom | undefined {
    return this.states.at(-1);
  }

  /**
   * Wait until a received room state matches.
   *
   * @param {(room: PublicRoom) => boolean} predicate What to wait for.
   * @param {number} timeoutMs How long to wait.
   *
   * @returns {Promise<PublicRoom>} The first matching state.
   *
   * @throws {Error} When no state matches in time.
   */
  async waitFor(
    predicate: (room: PublicRoom) => boolean,
    timeoutMs = 5000,
  ): Promise<PublicRoom> {

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const match = this.states.find(predicate);

      if (match) {
        return match;
      }

      await sleep(20);
    }

    throw new Error(`No matching state in ${timeoutMs}ms`);
  }

  /**
   * Send a command and wait for its acknowledgement.
   *
   * @param {string} event The event name.
   * @param {unknown} payload The payload, if the command takes one.
   *
   * @returns {Promise<any>} The command response.
   */
  emit(event: string, payload?: unknown): Promise<CommandResponse & any> {

    return new Promise((resolve) => {

      // commands without payload take the ack as their only argument
      if (payload === undefined) {
        this.socket.emit(event, resolve);
        return;
      }

      this.socket.emit(event, payload, resolve);
    });
  }

  /**
   * Forget the states received so far.
   *
   * @returns {void}
   */
  clear(): void {
    this.states.length = 0;
  }
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

// fresh keys for each test
beforeEach(() => {
  keyPrefix = `test:${randomUUID()}:`;
});

// close whatever each test opened, then drop its keys
afterEach(async () => {
  openClients.splice(0).forEach((client) => client.socket.disconnect());
  await Promise.all(openServers.splice(0).map(({ app }) => app.close()));

  if (!redis.isOpen) {
    await redis.connect();
  }

  const keys = await redis.keys(`${keyPrefix}*`);

  if (keys.length > 0) {
    await redis.del(keys);
  }
});

afterAll(async () => {
  if (redis.isOpen) {
    await redis.close();
  }
});
