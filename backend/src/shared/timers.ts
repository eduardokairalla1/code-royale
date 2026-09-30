/**
 * Keyed timers: at most one pending task per key.
 */

// --- IMPORTS ---
import { describeError } from './logging/error-fields.js';
import { Event } from './logging/events.js';
import { log } from './logging/events.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * A set of timers indexed by key. Timers never keep the process alive.
 */
export class TimerRegistry {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /**
   * Create the registry.
   *
   * @param {FastifyBaseLogger} logger Where failed tasks are logged.
   * @param {string} kind What the timers are for, e.g. "room_ttl".
   */
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly kind: string,
  ) {}

  /**
   * Run a task after a delay, unless a timer is already pending for the key.
   *
   * @param {string} key The timer's key.
   * @param {number} delayMs How long to wait.
   * @param {() => Promise<void>} task What to run when it fires.
   *
   * @returns {void}
   */
  start(key: string, delayMs: number, task: () => Promise<void>): void {

    // keep the original deadline
    if (this.timers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);

      task().catch((error: unknown) => {
        log(this.logger, 'error', Event.TimerFailed, {
          kind: this.kind,
          key,
          ...describeError(error).fields,
        });
      });
    }, delayMs);

    // pending timers must not keep the process alive
    timer.unref();

    this.timers.set(key, timer);
  }

  /**
   * Cancel the timer of a key, if any.
   *
   * @param {string} key The timer's key.
   *
   * @returns {void}
   */
  clear(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }
}
