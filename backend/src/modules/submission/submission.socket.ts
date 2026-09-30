/**
 * Submission socket handlers: run the examples, sync drafts and submit.
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

  const { codeSchema, draftSchema } = buildSchemas(limits);

  io.on('connection', (socket) => {

    const { roomCode, playerId } = socket.data;

    // run against the public examples, answered with each output
    socket.on('submission:run', (payload, ack) => {
      void runCommand(socket, 'submission:run', ack, logger, () => {
        const draft = parseInput(codeSchema, payload);
        return submissionService.runExamples(roomCode, playerId, draft);
      });
    });

    // keep the editor content, judged as is when time runs out; sent
    // while the player types, so only failures leave the debug level
    socket.on('submission:draft', (payload, ack) => {
      void runCommand(socket, 'submission:draft', ack, logger, () => {
        const draft = parseInput(draftSchema, payload);
        return submissionService.saveDraft(roomCode, playerId, draft);
      }, 'debug');
    });

    // the one submission against the hidden tests, answered with the verdict
    socket.on('submission:submit', (payload, ack) => {
      void runCommand(socket, 'submission:submit', ack, logger, () => {
        const draft = parseInput(codeSchema, payload);
        return submissionService.submit(roomCode, playerId, draft);
      });
    });
  });
}

/**
 * Build the payload schemas for the given limits.
 *
 * @param {SubmissionLimits} limits Enabled languages and code size.
 *
 * @returns The schema for run and submit, and the one for drafts.
 */
function buildSchemas({ languageIds, maxCodeLength }: SubmissionLimits) {

  const languageSchema = z.string().refine((id) => languageIds.includes(id), {
    message: 'Unsupported language',
  });

  // run and submit need something to run; the code is never altered
  const codeSchema = z.object({
    language: languageSchema,
    code: z.string().max(maxCodeLength).refine((code) => code.trim() !== '', {
      message: 'Code is empty',
    }),
  });

  // drafts may be empty: the player may have cleared the editor
  const draftSchema = z.object({
    language: languageSchema,
    code: z.string().max(maxCodeLength),
  });

  return { codeSchema, draftSchema };
}
