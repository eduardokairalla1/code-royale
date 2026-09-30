/**
 * Room socket handlers: authentication.
 */

// --- IMPORTS ---
import { toSocketError } from '../../shared/errors/socket-error.js';
import { describeError } from '../../shared/logging/error-fields.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { parseInput } from '../../shared/validation.js';
import type { AppServer } from '../../socket.js';
import type { RoomService } from './room.service.js';
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
}
