/**
 * HTTP error handlers.
 */

// --- IMPORTS ---
import { AppError } from './app-error.js';
import type { FastifyError } from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Register every error handler on the application.
 *
 * @param {FastifyInstance} app The Fastify instance.
 *
 * @returns {void}
 */
export function registerErrorHandlers(app: FastifyInstance): void {

  // the request's log event says what failed; it is logged once answered
  app.setErrorHandler<FastifyError>((error, request, reply) => {

    request.wideEvent?.fail(error);

    // app errors: shaped by the error class itself
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: error.slug, message: error.responseMessage });
    }

    // fastify http errors: malformed json, bad content-type, etc.
    if (error.statusCode !== undefined && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send({ error: 'http_error', message: error.message });
    }

    // anything else: answer a generic 500
    return reply
      .status(500)
      .send({ error: 'internal_error', message: 'Internal Server Error!' });
  });

  // unknown routes never reach the error handler; logged as any request
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send({ error: 'http_error', message: 'Not Found' });
  });
}
