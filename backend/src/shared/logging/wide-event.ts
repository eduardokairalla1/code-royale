/**
 * Wide events: one log line with everything about a unit of work.
 */

// --- IMPORTS ---
import { describeError } from './error-fields.js';
import { log } from './events.js';
import type { LogEvent } from './events.js';
import type { LogFields } from './events.js';
import type { FastifyBaseLogger } from 'fastify';
import type { LogLevel } from 'fastify';

// --- CODE ---
/**
 * Fields gathered while some work runs, logged once when it ends.
 */
export class WideEvent {
  private readonly fields: LogFields = { outcome: 'ok' };
  private readonly startedAt = performance.now();

  /**
   * Start the event, timing from now.
   *
   * @param {LogLevel} level The level when nothing fails.
   */
  constructor(private level: LogLevel = 'info') {}

  /**
   * Add fields.
   *
   * @param {LogFields} fields The fields.
   *
   * @returns {this} The event, to chain.
   */
  set(fields: LogFields): this {
    Object.assign(this.fields, fields);
    return this;
  }

  /**
   * Add to a counter field.
   *
   * @param {string} field The counter.
   *
   * @returns {void}
   */
  count(field: string): void {
    this.fields[field] = ((this.fields[field] as number | undefined) ?? 0) + 1;
  }

  /**
   * Mark the work as failed, at the error's level.
   *
   * @param {unknown} error The raised error.
   *
   * @returns {void}
   */
  fail(error: unknown): void {

    const { level, fields } = describeError(error);

    this.level = level;
    this.set({ ...fields, outcome: 'error' });
  }

  /**
   * Log the event with how long the work took.
   *
   * @param {FastifyBaseLogger} logger Where to log.
   * @param {LogEvent} event What the work was.
   *
   * @returns {void}
   */
  emit(logger: FastifyBaseLogger, event: LogEvent): void {

    log(logger, this.level, event, {
      ...this.fields,
      duration_ms: Math.round(performance.now() - this.startedAt),
    });
  }
}
