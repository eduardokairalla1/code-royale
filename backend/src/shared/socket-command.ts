/**
 * Client-to-server commands answered through a socket acknowledgement.
 */

// --- IMPORTS ---
import type { AppSocket } from '../socket.js';
import type { ErrorBody } from './errors/socket-error.js';
import { toErrorBody } from './errors/socket-error.js';
import { Event } from './logging/events.js';
import { WideEvent } from './logging/wide-event.js';
import type { FastifyBaseLogger } from 'fastify';
import type { LogLevel } from 'fastify';

// --- CODE ---
/**
 * What a command answers: ok with its result, or an error.
 */
export type CommandResponse = { ok: true; data?: unknown } | ErrorBody;

/**
 * The acknowledgement callback a client passes along with a command.
 */
export type CommandAck = (response: CommandResponse) => void;

/**
 * Run a command and answer the client through its acknowledgement.
 *
 * @param {AppSocket} socket The socket that sent it.
 * @param {string} name The command name, for logging.
 * @param {unknown} ack The callback sent by the client, if any.
 * @param {FastifyBaseLogger} logger Where to log it.
 * @param {() => Promise<unknown>} task The command, resolving to what the
 *                                    client gets as data.
 * @param {LogLevel} level The level when it succeeds; frequent commands
 *                         use debug.
 *
 * @returns {Promise<boolean>} True when the command succeeded.
 */
export async function runCommand(
  socket: AppSocket,
  name: string,
  ack: unknown,
  logger: FastifyBaseLogger,
  task: () => Promise<unknown>,
  level: LogLevel = 'info',
): Promise<boolean> {

  const event = new WideEvent(level).set({
    command: name,
    socket_id: socket.id,
    room_code: socket.data.roomCode,
    player_id: socket.data.playerId,
  });

  socket.data.event?.count('commands');

  // clients may skip the callback: answer nobody then
  const reply: CommandAck = typeof ack === 'function'
    ? (ack as CommandAck)
    : () => {};

  try {
    const data = await task();

    // commands without a result answer a bare ok
    reply(data === undefined ? { ok: true } : { ok: true, data });

    return true;

  // failed: tell the client why
  } catch (error) {
    event.fail(error);
    reply(toErrorBody(error));

    return false;

  } finally {
    event.emit(logger, Event.Command);
  }
}
