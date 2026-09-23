/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { systemRoutes } from './modules/system/system.routes.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Build the application with its error handlers and routes.
 *
 * @returns {FastifyInstance} The configured Fastify instance.
 */
export function buildApp(): FastifyInstance {

  const app = Fastify({
    logger: true,
  });

  // register the error handlers
  registerErrorHandlers(app);

  // register the routes
  app.register(systemRoutes);

  return app;
}
