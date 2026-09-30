/**
 * Game rules: start rounds.
 */

// --- IMPORTS ---
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import type { ChallengeService } from '../challenge/challenge.service.js';
import type { RoomService } from '../room/room.service.js';
import { GameAlreadyStartedError } from './game.errors.js';
import { createRound } from './game.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * Round lifecycle of a room: LOBBY -> PLAYING.
 */
export class GameService {

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {ChallengeService} challengeService The challenge catalog.
   * @param {FastifyBaseLogger} logger Where rounds are logged.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly challengeService: ChallengeService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Start a round with a challenge the room has not played yet.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who asked, must be the host.
   *
   * @returns {Promise<void>}
   *
   * @throws {NotHostError} When the player is not the host.
   * @throws {GameAlreadyStartedError} When the room is not in the lobby.
   */
  async start(code: string, playerId: string): Promise<void> {

    const room = await this.roomService.getAsHost(code, playerId);

    // only from the lobby
    if (room.status !== 'LOBBY') {
      throw new GameAlreadyStartedError({ code, status: room.status });
    }

    const challenge = this.challengeService.pickRandom(
      room.playedChallengeIds,
    );

    // everyone in the room right now takes part
    room.round = createRound(challenge, [...room.players.keys()]);
    room.status = 'PLAYING';
    room.playedChallengeIds.push(challenge.id);

    await this.roomService.update(room);

    log(this.logger, 'info', Event.RoundStarted, {
      room_code: room.code,
      player_id: playerId,
      challenge_id: challenge.id,
      difficulty: challenge.difficulty,
      players: room.round.results.size,
      time_limit_s: challenge.timeLimitSeconds,
    });
  }
}
