/**
 * Game rules: start rounds, end them, and go back to the lobby.
 */

// --- IMPORTS ---
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { TimerRegistry } from '../../shared/timers.js';
import type { ChallengeService } from '../challenge/challenge.service.js';
import type { RoomService } from '../room/room.service.js';
import { GameAlreadyStartedError } from './game.errors.js';
import { GameNotFinishedError } from './game.errors.js';
import { createRound } from './game.utils.js';
import { roundSummary } from './game.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- GLOBALS ---
// why a round ended: the clock
type FinishReason = 'time_up';

// --- CODE ---
/**
 * Round lifecycle of a room: LOBBY -> PLAYING -> FINISHED -> LOBBY.
 */
export class GameService {
  private readonly roundTimers: TimerRegistry;

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
  ) {
    this.roundTimers = new TimerRegistry(logger, 'round_clock');
  }

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

    // end the round when the clock runs out
    this.roundTimers.start(
      room.code,
      room.round.endsAt - Date.now(),
      () => this.finish(room.code, 'time_up'),
    );
  }

  /**
   * Send everyone back to the lobby after a round.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who asked, must be the host.
   *
   * @returns {Promise<void>}
   *
   * @throws {NotHostError} When the player is not the host.
   * @throws {GameNotFinishedError} When the round is not over.
   */
  async restart(code: string, playerId: string): Promise<void> {

    const room = await this.roomService.getAsHost(code, playerId);

    // only once the round is over
    if (room.status !== 'FINISHED') {
      throw new GameNotFinishedError({ code, status: room.status });
    }

    room.round = null;
    room.status = 'LOBBY';

    await this.roomService.update(room);

    log(this.logger, 'info', Event.RoundRestarted, {
      room_code: room.code,
      player_id: playerId,
    });
  }

  /**
   * End a running round and show the results.
   *
   * @param {string} code The room code.
   * @param {FinishReason} reason Why it ends now.
   *
   * @returns {Promise<void>}
   */
  private async finish(code: string, reason: FinishReason): Promise<void> {

    this.roundTimers.clear(code);

    const room = await this.roomService.find(code);

    // room gone or round already over
    if (!room || room.status !== 'PLAYING') {
      return;
    }

    room.status = 'FINISHED';

    await this.roomService.update(room);

    // how the round went
    if (room.round) {
      log(this.logger, 'info', Event.RoundFinished, {
        room_code: room.code,
        reason,
        ...roundSummary(room.round),
      });
    }
  }
}
