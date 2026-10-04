/**
 * Logger settings: json lines with the service's version on each.
 */

// --- IMPORTS ---
import type { FastifyServerOptions } from 'fastify';

// --- CODE ---
/**
 * The logger settings fastify takes.
 */
type LoggerOptions = Exclude<
  FastifyServerOptions['logger'],
  boolean | undefined
>;

/**
 * Build the logger settings.
 *
 * @param {string} level The lowest level logged.
 * @param {string} version The service version, e.g. "0.1.0".
 * @param {string} commit The commit it was built from.
 *
 * @returns {LoggerOptions} The fastify logger settings.
 */
export function loggerOptions(
  level: string,
  version: string,
  commit: string,
): LoggerOptions {

  return {
    level,
    base: { service: 'backend', version, commit },

    // same shape as the lsp service: iso time and "INFO"
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
  };
}
