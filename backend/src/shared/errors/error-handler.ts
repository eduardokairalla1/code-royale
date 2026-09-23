/**
 * HTTP error handlers.
 */

// --- IMPORTS ---
import { AppError } from './app-error.js';
import type { FastifyError } from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { FastifyRequest } from 'fastify';

// --- CODE ---
/**
 * Describe the route being handled, for logging.
 *
 * @param {FastifyRequest} request The incoming request.
 *
 * @returns {string} The method and url, e.g. "POST /api/rooms".
 */
function routeOf(request: FastifyRequest): string {
  return `${request.method} ${request.url}`;
}

/**
 * Register every error handler on the application.
 *
 * @param {FastifyInstance} app The Fastify instance.
 *
 * @returns {void}
 */
export function registerErrorHandlers(app: FastifyInstance): void {

  app.setErrorHandler<FastifyError>((error, request, reply) => {

    // app errors: shaped by the error class itself
    if (error instanceof AppError) {
      request.log[error.logLevel]({ details: error.details }, error.name);

      return reply
        .status(error.statusCode)
        .send({ error: error.slug, message: error.responseMessage });
    }

    // fastify http errors: malformed json, bad content-type, etc.
    if (error.statusCode !== undefined && error.statusCode < 500) {
      request.log.error(
        `Request "${routeOf(request)}" failed with ${error.statusCode}: `
          + error.message,
      );

      return reply
        .status(error.statusCode)
        .send({ error: 'http_error', message: error.message });
    }

    // anything else: log the stack, answer a generic 500
    request.log.error(
      { err: error },
      `Request "${routeOf(request)}" failed with an unhandled error`,
    );

    return reply
      .status(500)
      .send({ error: 'internal_error', message: 'Internal Server Error!' });
  });

  // unknown routes never reach the error handler
  app.setNotFoundHandler((request, reply) => {

    request.log.error(`Request "${routeOf(request)}" failed with 404`);

    return reply
      .status(404)
      .send({ error: 'http_error', message: 'Not Found' });
  });
}
