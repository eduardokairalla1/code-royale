/**
 * Game socket handlers: start a round and go back to the lobby.
 */

// --- IMPORTS ---
import { runCommand } from '../../shared/socket-command.js';
import type { AppServer } from '../../socket.js';
import type { GameService } from './game.service.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * Register the game handlers on the socket server.
 *
 * @param {AppServer} io The Socket.IO server.
 * @param {GameService} gameService The game rules.
 * @param {FastifyBaseLogger} logger Where to log errors.
 *
 * @returns {void}
 */
export function registerGameSocket(
  io: AppServer,
  gameService: GameService,
  logger: FastifyBaseLogger,
): void {

  io.on('connection', (socket) => {

    const { roomCode, playerId } = socket.data;

    // host starts a round
    socket.on('game:start', (ack) => {
      void runCommand(socket, 'game:start', ack, logger, () => {
        return gameService.start(roomCode, playerId);
      });
    });

    // host sends everyone back to the lobby
    socket.on('game:restart', (ack) => {
      void runCommand(socket, 'game:restart', ack, logger, () => {
        return gameService.restart(roomCode, playerId);
      });
    });
  });
}
