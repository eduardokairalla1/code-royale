/**
 * Game rules: start rounds, end them, and go back to the lobby.
 */

// --- IMPORTS ---
import { describeError } from '../../shared/logging/error-fields.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { TimerRegistry } from '../../shared/timers.js';
import type { ChallengeService } from '../challenge/challenge.service.js';
import type { RoomService } from '../room/room.service.js';
import type { SubmissionService } from '../submission/submission.service.js';
import { GameAlreadyStartedError } from './game.errors.js';
import { GameNotFinishedError } from './game.errors.js';
import { createRound } from './game.utils.js';
import { everyoneJudged } from './game.utils.js';
import { roundSummary } from './game.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- GLOBALS ---
// why a round ended: the clock, or nobody left to judge
type FinishReason = 'time_up' | 'everyone_judged';

// --- CODE ---
/**
 * Round lifecycle of a room: LOBBY -> PLAYING -> FINISHED -> LOBBY.
 */
export class GameService {
  private readonly roundTimers: TimerRegistry;

  // rooms whose round is being closed, so it only happens once
  private readonly finishing = new Set<string>();

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {ChallengeService} challengeService The challenge catalog.
   * @param {SubmissionService} submissionService Judges the submissions.
   * @param {FastifyBaseLogger} logger Where failures are logged.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly challengeService: ChallengeService,
    private readonly submissionService: SubmissionService,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.roundTimers = new TimerRegistry(logger, 'round_clock');

    // everyone submitted and got judged: no reason to wait for the clock
    this.roomService.onRoomChanged((room) => {
      if (room.status === 'PLAYING' && room.round
        && everyoneJudged(room.round)) {
        this.finish(room.code, 'everyone_judged').catch((error: unknown) => {
          log(this.logger, 'error', Event.RoundFinishFailed, {
            room_code: room.code,
            ...describeError(error).fields,
          });
        });
      }
    });
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
   * End a running round: judge the missing drafts, then show results.
   *
   * @param {string} code The room code.
   * @param {FinishReason} reason Why it ends now.
   *
   * @returns {Promise<void>}
   */
  private async finish(code: string, reason: FinishReason): Promise<void> {

    // already being closed, by the clock or by the last submission
    if (this.finishing.has(code)) {
      return;
    }

    this.finishing.add(code);

    try {
      this.roundTimers.clear(code);

      // time is up for everyone: submit what they have
      await this.submissionService.submitDrafts(code);

      const room = await this.roomService.find(code);

      // room gone or round already over
      if (!room || room.status !== 'PLAYING') {
        return;
      }

      room.status = 'FINISHED';

      await this.roomService.update(room);

      // how the round went, once every submission is judged
      if (room.round) {
        log(this.logger, 'info', Event.RoundFinished, {
          room_code: room.code,
          reason,
          ...roundSummary(room.round),
        });
      }

    } finally {
      this.finishing.delete(code);
    }
  }
}
