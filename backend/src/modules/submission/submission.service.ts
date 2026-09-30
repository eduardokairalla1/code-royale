/**
 * Submission rules: example runs.
 */

// --- IMPORTS ---
import { Event } from '../../shared/logging/events.js';
import { WideEvent } from '../../shared/logging/wide-event.js';
import type { ChallengeCase } from '../challenge/challenge.types.js';
import type { CodeExecutor } from '../executor/executor.types.js';
import type { ExecutionResult } from '../executor/executor.types.js';
import type { Draft } from '../game/game.types.js';
import type { PlayerResult } from '../game/game.types.js';
import type { Round } from '../game/game.types.js';
import type { RoomService } from '../room/room.service.js';
import type { Room } from '../room/room.types.js';
import { NotInRoundError } from './submission.errors.js';
import { RoundNotRunningError } from './submission.errors.js';
import { RunInProgressError } from './submission.errors.js';
import type { ExampleResult } from './submission.types.js';
import type { TestStatus } from './submission.types.js';
import { countStatuses } from './submission.utils.js';
import { judgeRun } from './submission.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * A running round seen by one of its players.
 */
interface ActiveRound {
  room: Room;
  round: Round;
  result: PlayerResult;
}

/**
 * Runs and judges player code through the code executor.
 */
export class SubmissionService {

  // players whose example run is still going: one at a time each
  private readonly runningPlayers = new Set<string>();

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {CodeExecutor} executor Runs the code in a sandbox.
   * @param {FastifyBaseLogger} logger Where runs are logged.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly executor: CodeExecutor,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Run the code against the public examples, one run at a time.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who is running.
   * @param {Draft} draft The language and the code.
   *
   * @returns {Promise<ExampleResult[]>} One result per example.
   *
   * @throws {RoundNotRunningError} When no round is running.
   * @throws {NotInRoundError} When the player is not in the round.
   * @throws {RunInProgressError} When their previous run is not done.
   */
  async runExamples(
    code: string,
    playerId: string,
    draft: Draft,
  ): Promise<ExampleResult[]> {

    const { round } = await this.getActiveRound(code, playerId);

    // one run at a time per player
    if (this.runningPlayers.has(playerId)) {
      throw new RunInProgressError({ code, playerId });
    }

    this.runningPlayers.add(playerId);

    const event = this.runEvent(code, playerId, draft);

    try {
      const examples = round.challenge.examples;
      const results = await this.runCases(draft, examples, event);

      const outcomes = examples.map((example, index) => {
        const result = results[index] as ExecutionResult;
        const status = judgeRun(result, example.output);

        return {
          input: example.input,
          expectedOutput: example.output,
          stdout: result.stdout,
          stderr: result.stderr,
          status,
          passed: status === 'OK',
        };
      });

      this.setStatuses(event, outcomes.map((outcome) => outcome.status));

      return outcomes;

    } catch (error) {
      event.fail(error);
      throw error;

    } finally {
      this.runningPlayers.delete(playerId);
      event.emit(this.logger, Event.ExamplesRun);
    }
  }

  /**
   * Start the log event of a run: whose, in what, never the code itself.
   *
   * @param {string} code The room code.
   * @param {string} playerId Whose run it is.
   * @param {Draft} draft The language and the code.
   *
   * @returns {WideEvent} The event, logged once the run ends.
   */
  private runEvent(code: string, playerId: string, draft: Draft): WideEvent {

    return new WideEvent().set({
      room_code: code,
      player_id: playerId,
      language: draft.language,
      code_length: draft.code.length,
    });
  }

  /**
   * Add how the cases went to a run's log event.
   *
   * @param {WideEvent} event The run's event.
   * @param {TestStatus[]} statuses The status of each case.
   *
   * @returns {void}
   */
  private setStatuses(event: WideEvent, statuses: TestStatus[]): void {

    event.set({
      passed: statuses.filter((status) => status === 'OK').length,
      total: statuses.length,
      statuses: countStatuses(statuses),
    });
  }

  /**
   * Run a program once per case, all in parallel.
   *
   * @param {Draft} draft The language and the code.
   * @param {ChallengeCase[]} cases The inputs to run it with.
   * @param {WideEvent} event Where the time spent in the sandbox goes.
   *
   * @returns {Promise<ExecutionResult[]>} One result per case, in order.
   */
  private async runCases(
    draft: Draft,
    cases: ChallengeCase[],
    event: WideEvent,
  ): Promise<ExecutionResult[]> {

    const startedAt = performance.now();

    try {
      return await Promise.all(cases.map((testCase) => this.executor.run({
        language: draft.language,
        code: draft.code,
        stdin: testCase.input,
      })));

    } finally {
      event.set({ executor_ms: Math.round(performance.now() - startedAt) });
    }
  }

  /**
   * Find the running round of a room, on behalf of one of its players.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who is asking.
   *
   * @returns {Promise<ActiveRound>} The room, its round and the result.
   *
   * @throws {RoundNotRunningError} When no round is running.
   * @throws {NotInRoundError} When the player is not in the round.
   */
  private async getActiveRound(
    code: string,
    playerId: string,
  ): Promise<ActiveRound> {

    const room = await this.roomService.getOrThrow(code);
    const round = room.round;

    // no round, or its time is already up
    if (room.status !== 'PLAYING' || !round || Date.now() >= round.endsAt) {
      throw new RoundNotRunningError({ code, status: room.status });
    }

    const result = round.results.get(playerId);

    // joined mid round: waits for the next one
    if (!result) {
      throw new NotInRoundError({ code, playerId });
    }

    return { room, round, result };
  }
}
