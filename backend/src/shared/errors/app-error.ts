/**
 * Base application error.
 */

// --- IMPORTS ---
import type { LogLevel } from 'fastify';

// --- CODE ---
/**
 * Base application error class.
 */
export class AppError extends Error {

  // base attributes for all errors
  static readonly MESSAGE: string = 'Generic application error';
  static readonly STATUS_CODE: number = 500;
  static readonly LOG_LEVEL: LogLevel = 'error';

  /**
   * Create the error with its class message.
   *
   * @param {unknown} details Optional internal context, only logged and
   *                          never sent to the client.
   */
  constructor(readonly details?: unknown) {
    super(new.target.MESSAGE);
    this.name = new.target.name;
  }

  /**
   * HTTP status declared by the error class.
   *
   * @returns {number} The status code.
   */
  get statusCode(): number {
    return (this.constructor as typeof AppError).STATUS_CODE;
  }

  /**
   * Log level declared by the error class.
   *
   * @returns {LogLevel} The log level.
   */
  get logLevel(): LogLevel {
    return (this.constructor as typeof AppError).LOG_LEVEL;
  }

  /**
   * Message sent to the client; subclasses may expose more.
   *
   * @returns {string | string[]} The client-facing message.
   */
  get responseMessage(): string | string[] {
    return this.message;
  }

  /**
   * Stable snake_case slug derived from the class name.
   *
   * @returns {string} The slug, e.g. "room_not_found_error".
   */
  get slug(): string {
    return this.name.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
  }
}
