/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { systemRoutes } from './modules/system/system.routes.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Build the application with its routes.
 *
 * @returns {FastifyInstance} The configured Fastify instance.
 */
export function buildApp(): FastifyInstance {

  const app = Fastify({
    logger: true,
  });

  // register the routes
  app.register(systemRoutes);

  return app;
}
