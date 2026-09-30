/**
 * Log events: every line names what happened, to filter by it.
 */

// --- IMPORTS ---
import type { FastifyBaseLogger } from 'fastify';
import type { LogLevel } from 'fastify';

// --- GLOBALS ---
export const Event = {

  // the server
  Started: 'started',
  StartFailed: 'start_failed',
  Stopped: 'stopped',

  // one per http request
  Request: 'request',
} as const;

// --- CODE ---
/**
 * The name of a log event.
 */
export type LogEvent = (typeof Event)[keyof typeof Event];

/**
 * Fields logged along with an event.
 */
export type LogFields = Record<string, unknown>;

/**
 * Log an event: its name goes in msg and in the event field.
 *
 * @param {FastifyBaseLogger} logger Where to log.
 * @param {LogLevel} level The level.
 * @param {LogEvent} event What happened.
 * @param {LogFields} fields What it happened to.
 *
 * @returns {void}
 */
export function log(
  logger: FastifyBaseLogger,
  level: LogLevel,
  event: LogEvent,
  fields: LogFields = {},
): void {
  logger[level]({ event, ...fields }, event);
}
