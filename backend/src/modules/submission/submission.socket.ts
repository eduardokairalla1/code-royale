/**
 * Submission socket handlers: run the examples.
 */

// --- IMPORTS ---
import { runCommand } from '../../shared/socket-command.js';
import { parseInput } from '../../shared/validation.js';
import type { AppServer } from '../../socket.js';
import type { SubmissionService } from './submission.service.js';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

// --- CODE ---
/**
 * Limits applied to what players send.
 */
export interface SubmissionLimits {
  // language ids enabled in this deployment
  languageIds: string[];
  maxCodeLength: number;
}

/**
 * Register the submission handlers on the socket server.
 *
 * @param {AppServer} io The Socket.IO server.
 * @param {SubmissionService} submissionService The submission rules.
 * @param {FastifyBaseLogger} logger Where to log errors.
 * @param {SubmissionLimits} limits Enabled languages and code size.
 *
 * @returns {void}
 */
export function registerSubmissionSocket(
  io: AppServer,
  submissionService: SubmissionService,
  logger: FastifyBaseLogger,
  limits: SubmissionLimits,
): void {

  const { codeSchema } = buildSchemas(limits);

  io.on('connection', (socket) => {

    const { roomCode, playerId } = socket.data;

    // run against the public examples, answered with each output
    socket.on('submission:run', (payload, ack) => {
      void runCommand(socket, 'submission:run', ack, logger, () => {
        const draft = parseInput(codeSchema, payload);
        return submissionService.runExamples(roomCode, playerId, draft);
      });
    });
  });
}

/**
 * Build the payload schemas for the given limits.
 *
 * @param {SubmissionLimits} limits Enabled languages and code size.
 *
 * @returns The schema for runs.
 */
function buildSchemas({ languageIds, maxCodeLength }: SubmissionLimits) {

  const languageSchema = z.string().refine((id) => languageIds.includes(id), {
    message: 'Unsupported language',
  });

  // runs need something to run; the code is never altered
  const codeSchema = z.object({
    language: languageSchema,
    code: z.string().max(maxCodeLength).refine((code) => code.trim() !== '', {
      message: 'Code is empty',
    }),
  });

  return { codeSchema };
}
