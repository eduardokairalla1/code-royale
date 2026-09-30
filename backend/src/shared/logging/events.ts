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

  // one per http request and per socket command
  Request: 'request',
  Command: 'command',

  // sockets: refused, connected, and a summary once closed
  SocketRefused: 'socket_refused',
  SocketConnected: 'socket_connected',
  Socket: 'socket',

  // rooms
  RoomCreated: 'room_created',
  PlayerJoined: 'player_joined',
  PlayerLeft: 'player_left',
  HostChanged: 'host_changed',
  RoomDeleted: 'room_deleted',
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
