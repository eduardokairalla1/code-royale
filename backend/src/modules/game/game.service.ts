/**
 * Game rules: start rounds, end them, and go back to the lobby.
 */

// --- IMPORTS ---
import { describeError } from '../../shared/logging/error-fields.js';
import { Event } from '../../shared/logging/events.js';
import { log } from '../../shared/logging/events.js';
import { acquireLock } from '../../shared/redis/lock.js';
import { releaseLock } from '../../shared/redis/lock.js';
import type { RedisClient } from '../../shared/redis/redis.js';
import type { Scheduler } from '../../shared/scheduler.js';
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
// the scheduled end of a round
const ROUND_CLOCK_TASK = 'round_clock';

// why a round ended: the clock, or nobody left to judge
type FinishReason = 'time_up' | 'everyone_judged';

// --- CODE ---
/**
 * Settings and dependencies of the game service.
 */
export interface GameServiceOptions {
  // the longest closing a round may take, judging included
  finishTimeoutMs: number;
  logger: FastifyBaseLogger;
}

/**
 * Round lifecycle of a room: LOBBY -> PLAYING -> FINISHED -> LOBBY.
 */
export class GameService {

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {ChallengeService} challengeService The challenge catalog.
   * @param {SubmissionService} submissionService Judges the submissions.
   * @param {Scheduler} scheduler Ends rounds on time.
   * @param {RedisClient} redis Holds the lock that closes a round.
   * @param {GameServiceOptions} options Timeout and logger.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly challengeService: ChallengeService,
    private readonly submissionService: SubmissionService,
    private readonly scheduler: Scheduler,
    private readonly redis: RedisClient,
    private readonly options: GameServiceOptions,
  ) {
    scheduler.handle(ROUND_CLOCK_TASK, (code) => this.finish(code, 'time_up'));

    // everyone submitted and got judged: no reason to wait for the clock
    this.roomService.onRoomChanged((room) => {
      if (room.status === 'PLAYING' && room.round
        && everyoneJudged(room.round)) {
        this.finish(room.code, 'everyone_judged').catch((error: unknown) => {
          log(this.options.logger, 'error', Event.RoundFinishFailed, {
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

    const { room, result: round } = await this.roomService.mutateAsHost(
      code,
      playerId,
      (room) => {

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

        return room.round;
      },
    );

    // end the round when the clock runs out, on whichever instance is up
    await this.scheduler.start(
      ROUND_CLOCK_TASK,
      room.code,
      round.endsAt - Date.now(),
    );

    log(this.options.logger, 'info', Event.RoundStarted, {
      room_code: room.code,
      player_id: playerId,
      challenge_id: round.challenge.id,
      difficulty: round.challenge.difficulty,
      players: round.results.size,
      time_limit_s: round.challenge.timeLimitSeconds,
    });
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

    const { room } = await this.roomService.mutateAsHost(
      code,
      playerId,
      (room) => {

        // only once the round is over
        if (room.status !== 'FINISHED') {
          throw new GameNotFinishedError({ code, status: room.status });
        }

        room.round = null;
        room.status = 'LOBBY';
      },
    );

    log(this.options.logger, 'info', Event.RoundRestarted, {
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

    const lockKey = `lock:finish:${code}`;
    const token = await acquireLock(
      this.redis,
      lockKey,
      this.options.finishTimeoutMs,
    );

    // already being closed, by the clock or by the last submission
    if (!token) {
      return;
    }

    try {
      await this.scheduler.clear(ROUND_CLOCK_TASK, code);

      // time is up for everyone: submit what they have
      await this.submissionService.submitDrafts(code);

      const change = await this.roomService.mutateIfExists(code, (room) => {

        // round already over
        if (room.status !== 'PLAYING') {
          return false;
        }

        room.status = 'FINISHED';

        return true;
      });

      // how the round went, once every submission is judged
      if (change?.result && change.room.round) {
        log(this.options.logger, 'info', Event.RoundFinished, {
          room_code: code,
          reason,
          ...roundSummary(change.room.round),
        });
      }

    } finally {
      await releaseLock(this.redis, lockKey, token);
    }
  }
}
