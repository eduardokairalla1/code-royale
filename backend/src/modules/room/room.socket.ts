/**
 * Room socket handlers: authentication and presence.
 */

// --- IMPORTS ---
import { toSocketError } from '../../shared/errors/socket-error.js';
import { describeError } from '../../shared/logging/error-fields.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { WideEvent } from '../../shared/logging/wide-event.js';
import { parseInput } from '../../shared/validation.js';
import type { AppServer } from '../../socket.js';
import type { AppSocket } from '../../socket.js';
import type { RoomService } from './room.service.js';
import { toPublicRoom } from './room.utils.js';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

// --- GLOBALS ---
const handshakeSchema = z.object({
  roomCode: z.string().trim().min(1).max(10),
  token: z.string().min(1).max(100),
});

// --- CODE ---
/**
 * Register the room handlers on the socket server.
 *
 * @param {AppServer} io The Socket.IO server.
 * @param {RoomService} roomService The room rules.
 * @param {FastifyBaseLogger} logger Where to log errors.
 *
 * @returns {void}
 */
export function registerRoomSocket(
  io: AppServer,
  roomService: RoomService,
  logger: FastifyBaseLogger,
): void {

  // push the new state to everyone in the room on every change
  roomService.onRoomChanged((room) => {
    io.to(room.code).emit('room:state', toPublicRoom(room));
  });

  // authenticate the socket before accepting the connection
  io.use(async (socket, next) => {
    try {
      const { roomCode, token } = parseInput(
        handshakeSchema,
        socket.handshake.auth,
      );

      const { room, player } = await roomService.authenticate(roomCode, token);

      socket.data.roomCode = room.code;
      socket.data.playerId = player.id;

      // timed from here: the summary says how long it stayed
      socket.data.event = new WideEvent().set({
        socket_id: socket.id,
        room_code: room.code,
        player_id: player.id,
      });

      next();

    // refused: the client gets { error, message } on connect_error
    } catch (error) {
      const { level, fields } = describeError(error);

      log(logger, level, Event.SocketRefused, {
        socket_id: socket.id,
        ...fields,
      });

      next(toSocketError(error));
    }
  });

  // bind every accepted socket to its player
  io.on('connection', (socket) => {
    void handleConnection(io, socket, roomService, logger);
  });
}

/**
 * Wire an authenticated socket to its player and room.
 *
 * @param {AppServer} io The Socket.IO server.
 * @param {AppSocket} socket The new socket.
 * @param {RoomService} roomService The room rules.
 * @param {FastifyBaseLogger} logger Where to log errors.
 *
 * @returns {Promise<void>}
 */
async function handleConnection(
  io: AppServer,
  socket: AppSocket,
  roomService: RoomService,
  logger: FastifyBaseLogger,
): Promise<void> {

  const { roomCode, playerId, event } = socket.data;

  // reason is socket.io's, e.g. "transport close" or "ping timeout"
  socket.on('disconnect', async (reason) => {
    event.set({ reason });

    try {
      await roomService.disconnect(roomCode, playerId, socket.id);

    // nothing to tell the client, it is already gone
    } catch (error) {
      event.fail(error);
    }

    event.emit(logger, Event.Socket);
  });

  // join the room first, so this socket gets the state broadcast too
  await socket.join(roomCode);

  try {
    const replacedSocketId = await roomService.connect(
      roomCode,
      playerId,
      socket.id,
    );

    // same player on a new tab: drop the old socket
    if (replacedSocketId !== null) {
      io.sockets.sockets.get(replacedSocketId)?.data.event?.set({
        closed_by: 'replaced',
      });
      io.in(replacedSocketId).disconnectSockets(true);
    }

    log(logger, 'info', Event.SocketConnected, {
      socket_id: socket.id,
      room_code: roomCode,
      player_id: playerId,
      replaced_socket_id: replacedSocketId,
    });

  // could not bind the player: close the socket; its summary says why
  } catch (error) {
    event.fail(error);
    event.set({ closed_by: 'bind_failed' });
    socket.disconnect(true);
  }
}
