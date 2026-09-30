/**
 * Socket.IO server and the events it exchanges with clients.
 */

// --- IMPORTS ---
import { config } from './config.js';
import type { WideEvent } from './shared/logging/wide-event.js';
import type { PublicRoom } from './modules/room/room.types.js';
import type { FastifyInstance } from 'fastify';
import type { DefaultEventsMap } from 'socket.io';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';

// --- GLOBALS ---
// where routes and the socket are served, also the public path
export const API_PREFIX = '/api';
export const SOCKET_PATH = `${API_PREFIX}/socket`;

// --- CODE ---
/**
 * Events the server sends to clients.
 */
export interface ServerToClientEvents {
  'room:state': (room: PublicRoom) => void;
}

/**
 * Events clients send to the server.
 */
export interface ClientToServerEvents {}

/**
 * Data attached to a socket once it is authenticated.
 */
export interface SocketData {
  roomCode: string;
  playerId: string;
  event: WideEvent;
}

/**
 * The typed Socket.IO server.
 */
export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

/**
 * A typed socket of the server.
 */
export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

/**
 * Create the Socket.IO server on top of the Fastify http server.
 *
 * @param {FastifyInstance} app The Fastify instance.
 *
 * @returns {AppServer} The Socket.IO server.
 */
export function createSocketServer(app: FastifyInstance): AppServer {

  const io: AppServer = new Server(app.server, {
    path: SOCKET_PATH,
    cors: { origin: config.corsOrigins },
  });

  return io;
}
