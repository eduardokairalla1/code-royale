/**
 * Socket.IO server and the events it exchanges with clients.
 */

// --- IMPORTS ---
import { config } from './config.js';
import { RateLimitedError } from './shared/errors/rate-limited-error.js';
import { toErrorBody } from './shared/errors/socket-error.js';
import { Event } from './shared/logging/events.js';
import { log } from './shared/logging/events.js';
import type { WideEvent } from './shared/logging/wide-event.js';
import type { PublicRoom } from './modules/room/room.types.js';
import type { CommandAck } from './shared/socket-command.js';
import type { FastifyInstance } from 'fastify';
import type { DefaultEventsMap } from 'socket.io';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';

// --- GLOBALS ---
// where routes and the socket are served, also the public path
export const API_PREFIX = '/api';
export const SOCKET_PATH = `${API_PREFIX}/socket`;

// events per socket, far above what the editor sends
const EVENTS_PER_SECOND = 10;
const EVENTS_BURST = 20;

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
export interface ClientToServerEvents {
  'room:leave': (ack?: CommandAck) => void;
  'game:start': (ack?: CommandAck) => void;
  'game:restart': (ack?: CommandAck) => void;
  'submission:run': (payload: unknown, ack?: CommandAck) => void;
}

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

  // drop every socket before fastify closes, or the close hangs on them
  app.addHook('preClose', async () => {
    for (const socket of io.sockets.sockets.values()) {
      socket.data.event?.set({ closed_by: 'shutdown' });
    }

    io.disconnectSockets(true);
  });

  io.on('connection', (socket) => limitEvents(socket, app));

  return io;
}

/**
 * Refuse events past the socket's rate, with a token bucket.
 *
 * @param {AppSocket} socket The socket to limit.
 * @param {FastifyInstance} app Where refusals are logged.
 *
 * @returns {void}
 */
function limitEvents(socket: AppSocket, app: FastifyInstance): void {

  let tokens = EVENTS_BURST;
  let refilledAt = Date.now();

  // logged once per flood, not once per dropped event
  let refusing = false;

  socket.use((packet, next) => {
    const now = Date.now();

    tokens = Math.min(
      EVENTS_BURST,
      tokens + ((now - refilledAt) / 1000) * EVENTS_PER_SECOND,
    );
    refilledAt = now;

    if (tokens >= 1) {
      tokens -= 1;
      refusing = false;
      next();
      return;
    }

    // over the rate: dropped, and the ack, if any, says why
    const ack = packet.at(-1);

    socket.data.event?.count('limited');

    if (!refusing) {
      log(app.log, 'warn', Event.RateLimited, {
        socket_id: socket.id,
        room_code: socket.data.roomCode,
        player_id: socket.data.playerId,
        command: String(packet[0]),
      });
      refusing = true;
    }

    if (typeof ack === 'function') {
      ack(toErrorBody(new RateLimitedError()));
    }
  });
}
