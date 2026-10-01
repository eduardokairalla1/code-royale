/**
 * Delayed tasks kept in Redis, run once by whichever instance is up.
 */

// --- IMPORTS ---
import { describeError } from './logging/error-fields.js';
import { Event } from './logging/events.js';
import { log } from './logging/events.js';
import type { RedisClient } from './redis/redis.js';
import type { FastifyBaseLogger } from 'fastify';

// --- GLOBALS ---
const SCHEDULE_KEY = 'schedule';

// separates a task's kind from its key in the sorted set
const SEPARATOR = '|';

// tasks claimed per poll
const BATCH_SIZE = 50;

// claim what is due: push its deadline to the end of the lease, so a task
// whose instance dies runs again elsewhere once the lease runs out
const CLAIM_SCRIPT = `
local due = redis.call(
  'ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[3]
)
for _, task in ipairs(due) do
  redis.call('ZADD', KEYS[1], ARGV[2], task)
end
return due
`;

// forget a task once run, unless it was scheduled again meanwhile
const DONE_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if score and tonumber(score) == tonumber(ARGV[2]) then
  return redis.call('ZREM', KEYS[1], ARGV[1])
end
return 0
`;

// --- CODE ---
/**
 * Runs the tasks of one kind, given the key they were scheduled with.
 */
export type TaskHandler = (key: string) => Promise<void>;

/**
 * Settings of the scheduler.
 */
export interface SchedulerOptions {
  // how often due tasks are looked for
  pollMs: number;
  // how long a claimed task may run before another instance retries it
  leaseMs: number;
  logger: FastifyBaseLogger;
}

/**
 * Keyed delayed tasks: at most one pending task per kind and key.
 */
export class Scheduler {
  private readonly handlers = new Map<string, TaskHandler>();

  // tasks running here, so stopping waits for them
  private readonly running = new Set<Promise<void>>();

  private timer: NodeJS.Timeout | null = null;
  private stopped = true;

  /**
   * Create the scheduler, not polling yet.
   *
   * @param {RedisClient} redis The Redis client.
   * @param {SchedulerOptions} options Poll interval, lease and logger.
   */
  constructor(
    private readonly redis: RedisClient,
    private readonly options: SchedulerOptions,
  ) {}

  /**
   * Set what runs the tasks of a kind; every instance sets the same.
   *
   * @param {string} kind What the tasks are for, e.g. "room_ttl".
   * @param {TaskHandler} handler Runs one of them.
   *
   * @returns {void}
   */
  handle(kind: string, handler: TaskHandler): void {
    this.handlers.set(kind, handler);
  }

  /**
   * Run a task after a delay, unless one is already pending for the key.
   *
   * @param {string} kind The task's kind.
   * @param {string} key The task's key.
   * @param {number} delayMs How long to wait.
   *
   * @returns {Promise<void>}
   */
  async start(kind: string, key: string, delayMs: number): Promise<void> {

    // keep the original deadline
    await this.redis.zAdd(
      SCHEDULE_KEY,
      { score: Date.now() + delayMs, value: toTask(kind, key) },
      { condition: 'NX' },
    );
  }

  /**
   * Cancel the pending task of a key, if any.
   *
   * @param {string} kind The task's kind.
   * @param {string} key The task's key.
   *
   * @returns {Promise<void>}
   */
  async clear(kind: string, key: string): Promise<void> {
    await this.redis.zRem(SCHEDULE_KEY, toTask(kind, key));
  }

  /**
   * Start looking for due tasks.
   *
   * @returns {void}
   */
  run(): void {

    this.stopped = false;
    this.schedulePoll();
  }

  /**
   * Stop looking for tasks and wait for the ones running here.
   *
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {

    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await Promise.allSettled([...this.running]);
  }

  /**
   * Poll again after the interval.
   *
   * @returns {void}
   */
  private schedulePoll(): void {

    if (this.stopped) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.poll().finally(() => this.schedulePoll());
    }, this.options.pollMs);

    // a pending poll must not keep the process alive
    this.timer.unref();
  }

  /**
   * Claim the due tasks and run each one.
   *
   * @returns {Promise<void>}
   */
  private async poll(): Promise<void> {

    const leaseUntil = Date.now() + this.options.leaseMs;

    let due: string[];

    // redis away for a moment: try again on the next poll
    try {
      due = await this.redis.eval(CLAIM_SCRIPT, {
        keys: [SCHEDULE_KEY],
        arguments: [String(Date.now()), String(leaseUntil), String(BATCH_SIZE)],
      }) as string[];

    } catch (error) {
      this.logFailure('scheduler', '', error);
      return;
    }

    for (const task of due) {
      const running = this.runTask(task, leaseUntil);

      this.running.add(running);
      void running.finally(() => this.running.delete(running));
    }
  }

  /**
   * Run one claimed task, then forget it.
   *
   * @param {string} task The task, kind and key.
   * @param {number} leaseUntil The deadline it was claimed with.
   *
   * @returns {Promise<void>}
   */
  private async runTask(task: string, leaseUntil: number): Promise<void> {

    const [kind, key] = fromTask(task);
    const handler = this.handlers.get(kind);

    try {
      if (handler) {
        await handler(key);
      }

    // failed: logged, and not retried, like a timer that threw
    } catch (error) {
      this.logFailure(kind, key, error);
    }

    try {
      await this.redis.eval(DONE_SCRIPT, {
        keys: [SCHEDULE_KEY],
        arguments: [task, String(leaseUntil)],
      });

    // left in place: retried once its lease runs out
    } catch (error) {
      this.logFailure(kind, key, error);
    }
  }

  /**
   * Log a task that failed.
   *
   * @param {string} kind The task's kind.
   * @param {string} key The task's key.
   * @param {unknown} error What went wrong.
   *
   * @returns {void}
   */
  private logFailure(kind: string, key: string, error: unknown): void {

    log(this.options.logger, 'error', Event.TimerFailed, {
      kind,
      key,
      ...describeError(error).fields,
    });
  }
}

/**
 * Join a task's kind and key into its member of the sorted set.
 *
 * @param {string} kind The task's kind.
 * @param {string} key The task's key.
 *
 * @returns {string} The member.
 */
function toTask(kind: string, key: string): string {
  return `${kind}${SEPARATOR}${key}`;
}

/**
 * Split a member of the sorted set into its kind and key.
 *
 * @param {string} task The member.
 *
 * @returns {[string, string]} The kind and the key.
 */
function fromTask(task: string): [string, string] {

  const at = task.indexOf(SEPARATOR);

  return [task.slice(0, at), task.slice(at + 1)];
}
