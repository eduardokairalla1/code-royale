/**
 * Language server socket handlers: hand out tickets to the lsp service.
 */

// --- IMPORTS ---
import { runCommand } from '../../shared/socket-command.js';
import { parseInput } from '../../shared/validation.js';
import type { AppServer } from '../../socket.js';
import type { LspService } from './lsp.service.js';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

// --- CODE ---
/**
 * Register the language server handlers on the socket server.
 *
 * @param {AppServer} io The Socket.IO server.
 * @param {LspService} lspService The ticket rules.
 * @param {FastifyBaseLogger} logger Where to log errors.
 * @param {string[]} languageIds Language ids enabled in this deployment.
 *
 * @returns {void}
 */
export function registerLspSocket(
  io: AppServer,
  lspService: LspService,
  logger: FastifyBaseLogger,
  languageIds: string[],
): void {

  const ticketSchema = z.object({
    language: z.string().refine((id) => languageIds.includes(id), {
      message: 'Unsupported language',
    }),
  });

  io.on('connection', (socket) => {

    const { roomCode, playerId } = socket.data;

    // a short-lived ticket to start the editor's language server
    socket.on('lsp:ticket', (payload, ack) => {
      void runCommand(socket, 'lsp:ticket', ack, logger, () => {
        const { language } = parseInput(ticketSchema, payload);
        return lspService.issueTicket(roomCode, playerId, language);
      });
    });
  });
}
