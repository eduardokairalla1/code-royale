/**
 * Submission rules: example runs, drafts and the judged submission.
 */

// --- IMPORTS ---
import { Event } from '../../shared/logging/events.js';
import { WideEvent } from '../../shared/logging/wide-event.js';
import { acquireLock } from '../../shared/redis/lock.js';
import { releaseLock } from '../../shared/redis/lock.js';
import type { RedisClient } from '../../shared/redis/redis.js';
import { Semaphore } from '../../shared/redis/semaphore.js';
import type { ChallengeCase } from '../challenge/challenge.types.js';
import { ExecutorBusyError } from '../executor/executor.errors.js';
import type { CodeExecutor } from '../executor/executor.types.js';
import type { ExecutionResult } from '../executor/executor.types.js';
import { GameNotFinishedError } from '../game/game.errors.js';
import type { Draft } from '../game/game.types.js';
import type { PlayerResult } from '../game/game.types.js';
import type { Round } from '../game/game.types.js';
import type { RoomService } from '../room/room.service.js';
import type { Room } from '../room/room.types.js';
import type { DraftStore } from './draft.store.js';
import { AlreadySubmittedError } from './submission.errors.js';
import { NoSubmissionError } from './submission.errors.js';
import { NotInRoundError } from './submission.errors.js';
import { RoundNotRunningError } from './submission.errors.js';
import { RunInProgressError } from './submission.errors.js';
import type { ExampleResult } from './submission.types.js';
import type { TestStatus } from './submission.types.js';
import type { Verdict } from './submission.types.js';
import { countStatuses } from './submission.utils.js';
import { judgeRun } from './submission.utils.js';
import { toVerdict } from './submission.utils.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * Settings and dependencies of the submission service.
 */
export interface SubmissionServiceOptions {
  // example runs at once, across every room and instance
  maxConcurrentRuns: number;
  // the longest a run or a judging may take before it counts as lost
  judgeTimeoutMs: number;
  logger: FastifyBaseLogger;
}

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

  // example runs going on, across every instance
  private readonly runs: Semaphore;

  // submissions being judged, by room code, so the round can wait for them
  private readonly judging = new Map<string, Set<Promise<unknown>>>();

  /**
   * Create the service.
   *
   * @param {RoomService} roomService The room rules.
   * @param {DraftStore} drafts Where drafts are kept.
   * @param {CodeExecutor} executor Runs the code in a sandbox.
   * @param {RedisClient} redis Holds the run locks.
   * @param {SubmissionServiceOptions} options Limits and logger.
   */
  constructor(
    private readonly roomService: RoomService,
    private readonly drafts: DraftStore,
    private readonly executor: CodeExecutor,
    private readonly redis: RedisClient,
    private readonly options: SubmissionServiceOptions,
  ) {
    this.runs = new Semaphore(
      redis,
      'runs',
      options.maxConcurrentRuns,
      options.judgeTimeoutMs,
    );
  }

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
   * @throws {ExecutorBusyError} When too many runs are already going.
   */
  async runExamples(
    code: string,
    playerId: string,
    draft: Draft,
  ): Promise<ExampleResult[]> {

    const { round } = await this.getActiveRound(code, playerId);

    // one run at a time per player
    const lockKey = `lock:run:${playerId}`;
    const token = await acquireLock(
      this.redis,
      lockKey,
      this.options.judgeTimeoutMs,
    );

    if (!token) {
      throw new RunInProgressError({ code, playerId });
    }

    const event = this.runEvent(code, playerId, draft);

    try {

      // past the global cap runs only queue up; submissions are never refused
      if (!(await this.runs.acquire(token))) {
        throw new ExecutorBusyError({ running: await this.runs.count() });
      }

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
      await this.runs.release(token);
      await releaseLock(this.redis, lockKey, token);
      event.emit(this.options.logger, Event.ExamplesRun);
    }
  }

  /**
   * Keep the player's latest code, submitted as is when time runs out.
   *
   * @param {string} code The room code.
   * @param {string} playerId Whose draft it is.
   * @param {Draft} draft The language and the code.
   *
   * @returns {Promise<void>}
   */
  async saveDraft(code: string, playerId: string, draft: Draft): Promise<void> {

    const room = await this.roomService.find(code);
    const round = room?.round;
    const result = round?.results.get(playerId);

    // nothing to keep it for
    if (!room || room.status !== 'PLAYING' || !round || !result) {
      return;
    }

    // already submitted: a late draft must not replace the judged code
    if (result.submittedAt !== null) {
      return;
    }

    // no broadcast: drafts are private and change on every keystroke
    await this.drafts.save(room.code, round.startedAt, playerId, draft);
  }

  /**
   * Judge the one submission of a player against the hidden tests.
   *
   * @param {string} code The room code.
   * @param {string} playerId Who is submitting.
   * @param {Draft} draft The language and the code.
   *
   * @returns {Promise<Verdict>} How many hidden tests passed.
   *
   * @throws {RoundNotRunningError} When no round is running.
   * @throws {NotInRoundError} When the player is not in the round.
   * @throws {AlreadySubmittedError} When the player already submitted.
   * @throws {ExecutorUnavailableError} When the sandbox is down; the
   *                                    submission is then undone.
   */
  async submit(code: string, playerId: string, draft: Draft): Promise<Verdict> {

    // tracked from the start, so the round end waits for it
    return this.track(code, async () => {

      const { room, round, result } = await this.getActiveRound(
        code,
        playerId,
      );

      // one submission per round
      if (result.submittedAt !== null) {
        throw new AlreadySubmittedError({ code, playerId });
      }

      // lock it right away: everyone sees it as submitted, being judged
      result.submittedAt = Date.now();
      round.submissions.set(playerId, draft);

      await this.roomService.update(room);

      try {
        return await this.judge(room.code, playerId, draft, false);

      // could not judge: undo, so the player can submit again
      } catch (error) {
        result.submittedAt = null;
        round.submissions.delete(playerId);
        await this.roomService.update(room);

        throw error;
      }
    });
  }

  /**
   * The code a player submitted, once the round is over.
   *
   * @param {string} code The room code.
   * @param {string} playerId Whose code to show.
   *
   * @returns {Promise<Draft>} The language and the code that was judged.
   *
   * @throws {GameNotFinishedError} When the round is not over.
   * @throws {NoSubmissionError} When the player did not submit.
   */
  async getSubmission(code: string, playerId: string): Promise<Draft> {

    const room = await this.roomService.getOrThrow(code);

    // hidden while the round runs, so nobody copies
    if (room.status !== 'FINISHED' || !room.round) {
      throw new GameNotFinishedError({ code, status: room.status });
    }

    const submission = room.round.submissions.get(playerId);

    if (!submission) {
      throw new NoSubmissionError({ code, playerId });
    }

    return submission;
  }

  /**
   * Time is up: wait for judging, then submit every missing draft.
   *
   * @param {string} code The room code.
   *
   * @returns {Promise<void>}
   */
  async submitDrafts(code: string): Promise<void> {

    // let manual submissions land first
    await Promise.allSettled([...(this.judging.get(code) ?? [])]);

    const room = await this.roomService.find(code);
    const round = room?.round;

    if (!room || !round) {
      return;
    }

    const drafts = await this.drafts.getAll(room.code, round.startedAt);
    const pending: Promise<unknown>[] = [];

    for (const [playerId, result] of round.results) {
      const draft = drafts.get(playerId);

      // already submitted, or never wrote anything
      if (result.submittedAt !== null || !draft?.code.trim()) {
        continue;
      }

      // submitted at the deadline, on their behalf
      result.submittedAt = round.endsAt;
      result.autoSubmitted = true;
      round.submissions.set(playerId, draft);

      pending.push(this.judgeDraft(room.code, playerId, draft, result));
    }

    await this.roomService.update(room);
    await Promise.all(pending);
  }

  /**
   * Judge a draft submitted at time out; a failure scores zero.
   *
   * @param {string} code The room code.
   * @param {string} playerId Whose draft it is.
   * @param {Draft} draft The language and the code.
   * @param {PlayerResult} result The player's result, already submitted.
   *
   * @returns {Promise<void>}
   */
  private async judgeDraft(
    code: string,
    playerId: string,
    draft: Draft,
    result: PlayerResult,
  ): Promise<void> {

    try {
      await this.judge(code, playerId, draft, true);

    // sandbox down at the deadline: nothing passed; judge logged why
    } catch {
      const room = await this.roomService.find(code);

      result.passed = 0;
      result.total = room?.round?.challenge.tests.length ?? 0;

      if (room) {
        await this.roomService.update(room);
      }
    }
  }

  /**
   * Run the hidden tests and record how many passed.
   *
   * @param {string} code The room code.
   * @param {string} playerId Whose submission it is.
   * @param {Draft} draft The language and the code.
   * @param {boolean} auto Whether time ran out and it was sent for them.
   *
   * @returns {Promise<Verdict>} The verdict.
   *
   * @throws {ExecutorUnavailableError} When the sandbox is down.
   */
  private async judge(
    code: string,
    playerId: string,
    draft: Draft,
    auto: boolean,
  ): Promise<Verdict> {

    const event = this.runEvent(code, playerId, draft).set({ auto });

    try {
      const room = await this.roomService.getOrThrow(code);
      const tests = room.round?.challenge.tests ?? [];

      const results = await this.runCases(draft, tests, event);
      const statuses = tests.map((test, index) => {
        return judgeRun(results[index] as ExecutionResult, test.output);
      });

      const verdict = toVerdict(results, statuses);

      this.setStatuses(event, statuses);
      event.set({ verdict: verdict.status });

      // the player may have left while it ran
      const current = await this.roomService.find(code);
      const result = current?.round?.results.get(playerId);

      if (current && result) {
        result.passed = verdict.passed;
        result.total = verdict.total;

        await this.roomService.update(current);
      }

      event.set({ recorded: Boolean(current && result) });

      return verdict;

    } catch (error) {
      event.fail(error);
      throw error;

    } finally {
      event.emit(this.options.logger, Event.SubmissionJudged);
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

  /**
   * Keep track of a submission until it settles.
   *
   * @param {string} code The room code.
   * @param {() => Promise<T>} task The submission.
   *
   * @returns {Promise<T>} Whatever the submission resolves to.
   */
  private track<T>(code: string, task: () => Promise<T>): Promise<T> {

    const inFlight = this.judging.get(code) ?? new Set<Promise<unknown>>();
    const promise = task();

    inFlight.add(promise);
    this.judging.set(code, inFlight);

    // forget it once settled, and the room once nothing is left
    const forget = (): void => {
      inFlight.delete(promise);

      if (inFlight.size === 0) {
        this.judging.delete(code);
      }
    };

    promise.then(forget, forget);

    return promise;
  }
}
