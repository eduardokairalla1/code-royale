/**
 * Language server rules: who gets a ticket for the lsp service.
 */

// --- IMPORTS ---
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import type { RoomService } from '../room/room.service.js';
import { NotInRoundError } from '../submission/submission.errors.js';
import { RoundNotRunningError } from '../submission/submission.errors.js';
import { LspUnavailableError } from './lsp.errors.js';
import type { Ticket } from './lsp.types.js';
import { signTicket } from './lsp.utils.js';
import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';

// --- CODE ---
/**
 * Settings of the lsp service.
 */
export interface LspServiceOptions {
  // unset turns the language servers off
  secret: string | undefined;
  ticketTtlMs: number;
  logger: FastifyBaseLogger;
}

/**
 * Hands out lsp tickets, only to players of a running round.
 */
export class LspService {

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {LspServiceOptions} options The secret and ticket lifetime.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly options: LspServiceOptions,
  ) {}

  /**
   * Issue a ticket for a language server.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who asks.
   * @param {string} language The language id, already validated.
   *
   * @returns {Promise<Ticket>} The ticket and when it expires.
   *
   * @throws {LspUnavailableError} When language servers are turned off.
   * @throws {RoundNotRunningError} When no round is running.
   * @throws {NotInRoundError} When the player is not in the round.
   */
  async issueTicket(
    code: string,
    playerId: string,
    language: string,
  ): Promise<Ticket> {

    const { secret, ticketTtlMs, logger } = this.options;

    if (!secret) {
      throw new LspUnavailableError();
    }

    const room = await this.roomService.getOrThrow(code);

    // only while playing: nobody else types code
    if (room.status !== 'PLAYING' || !room.round) {
      throw new RoundNotRunningError({ code, status: room.status });
    }

    if (!room.round.results.has(playerId)) {
      throw new NotInRoundError({ code, playerId });
    }

    const expiresAt = Date.now() + ticketTtlMs;
    const ticketId = randomUUID();

    const ticket = signTicket(secret, {
      lang: language,
      sub: playerId,
      exp: Math.floor(expiresAt / 1000),
      jti: ticketId,
      end: Math.ceil(room.round.endsAt / 1000),
    });

    // the lsp service logs the same ticket_id: the two logs join on it
    log(logger, 'info', Event.TicketIssued, {
      room_code: room.code,
      player_id: playerId,
      language,
      ticket_id: ticketId,
      expires_at: new Date(expiresAt).toISOString(),
    });

    return { ticket, expiresAt };
  }
}
