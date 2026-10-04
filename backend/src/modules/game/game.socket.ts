/**
 * Game socket handlers: difficulties, start and back to the lobby.
 */

// --- IMPORTS ---
import { runCommand } from '../../shared/socket-command.js';
import { parseInput } from '../../shared/validation.js';
import type { AppServer } from '../../socket.js';
import { CHALLENGE_DIFFICULTIES } from '../challenge/challenge.types.js';
import type { GameService } from './game.service.js';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

// --- GLOBALS ---
// the difficulties the next rounds may draw
const difficultiesSchema = z.object({
  difficulties: z.array(z.enum(CHALLENGE_DIFFICULTIES)).min(1).max(10),
});

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

    // host picks the difficulties, in the lobby
    socket.on('game:difficulties', (payload, ack) => {
      void runCommand(socket, 'game:difficulties', ack, logger, () => {
        const { difficulties } = parseInput(difficultiesSchema, payload);
        return gameService.setDifficulties(roomCode, playerId, difficulties);
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
