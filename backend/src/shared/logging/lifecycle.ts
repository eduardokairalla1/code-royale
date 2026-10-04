/**
 * Server lifecycle events.
 */

// --- IMPORTS ---
import { describeError } from './error-fields.js';
import { Event } from './events.js';
import { log } from './events.js';
import type { LogFields } from './events.js';
import type { FastifyBaseLogger } from 'fastify';

// --- CODE ---
/**
 * Log the server as started, with the settings that shape it.
 *
 * @param {FastifyBaseLogger} logger Where to log.
 * @param {LogFields} settings What it runs with; never secrets.
 *
 * @returns {void}
 */
export function logStarted(
  logger: FastifyBaseLogger,
  settings: LogFields,
): void {
  log(logger, 'info', Event.Started, settings);
}

/**
 * Log the server as unable to start.
 *
 * @param {FastifyBaseLogger} logger Where to log.
 * @param {unknown} error Why.
 *
 * @returns {void}
 */
export function logStartFailed(
  logger: FastifyBaseLogger,
  error: unknown,
): void {
  log(logger, 'error', Event.StartFailed, { err: error });
}

/**
 * Log the server as stopped, and whether it closed cleanly.
 *
 * @param {FastifyBaseLogger} logger Where to log.
 * @param {string} signal What asked it to stop.
 * @param {number} startedAt When it began stopping, from performance.now().
 * @param {unknown} error Why it did not close cleanly, if it did not.
 *
 * @returns {void}
 */
export function logStopped(
  logger: FastifyBaseLogger,
  signal: string,
  startedAt: number,
  error?: unknown,
): void {

  const fields: LogFields = {
    signal,
    duration_ms: Math.round(performance.now() - startedAt),
  };

  // closed cleanly
  if (error === undefined) {
    log(logger, 'info', Event.Stopped, fields);
    return;
  }

  log(logger, 'error', Event.Stopped, {
    ...fields,
    ...describeError(error).fields,
  });
}
