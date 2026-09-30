/**
 * Socket error helpers: same envelope as the http responses.
 */

// --- IMPORTS ---
import { AppError } from './app-error.js';
import type { ExtendedError } from 'socket.io';

// --- CODE ---
/**
 * The error envelope sent to clients.
 */
export interface ErrorBody {
  error: string;
  message: string | string[];
}

/**
 * Build the client-facing envelope of an error.
 *
 * @param {unknown} error The raised error.
 *
 * @returns {ErrorBody} The error slug and message, no internals.
 */
export function toErrorBody(error: unknown): ErrorBody {

  // anything that is not ours: generic message
  if (!(error instanceof AppError)) {
    return { error: 'internal_error', message: 'Internal Server Error!' };
  }

  return { error: error.slug, message: error.responseMessage };
}

/**
 * Build the error used to refuse a connection, carrying the envelope.
 *
 * @param {unknown} error The raised error.
 *
 * @returns {ExtendedError} The error, with { error, message } as data.
 */
export function toSocketError(error: unknown): ExtendedError {

  const body = toErrorBody(error);
  const socketError: ExtendedError = new Error(String(body.message));

  socketError.data = body;

  return socketError;
}
