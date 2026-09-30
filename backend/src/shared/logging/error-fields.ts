/**
 * How an error shows up in the logs.
 */

// --- IMPORTS ---
import { AppError } from '../errors/app-error.js';
import type { LogFields } from './events.js';
import type { LogLevel } from 'fastify';

// --- CODE ---
/**
 * An error's log level and fields.
 */
export interface ErrorLog {
  level: LogLevel;
  fields: LogFields;
}

/**
 * Describe an error for the logs.
 *
 * @param {unknown} error The raised error.
 *
 * @returns {ErrorLog} The level and fields to log it with.
 */
export function describeError(error: unknown): ErrorLog {

  // ours: the class declares its level, details say what it was about
  if (error instanceof AppError) {
    return {
      level: error.logLevel,
      fields: { error: error.slug, details: error.details },
    };
  }

  // fastify's client errors: malformed json, bad content-type, etc.
  if (isClientError(error)) {
    return {
      level: 'warn',
      fields: { error: 'http_error', details: error.message },
    };
  }

  // a bug: the stack goes along
  return { level: 'error', fields: { error: 'internal_error', err: error } };
}

/**
 * Tell whether an error is a client error thrown by fastify.
 *
 * @param {unknown} error The raised error.
 *
 * @returns {boolean} True for errors with a 4xx status.
 */
function isClientError(error: unknown): error is Error {

  const status = (error as { statusCode?: unknown } | null)?.statusCode;

  return error instanceof Error && typeof status === 'number' && status < 500;
}
