/**
 * System routes.
 */

// --- IMPORTS ---
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Register the system routes.
 *
 * @param {FastifyInstance} app The Fastify instance.
 *
 * @returns {Promise<void>}
 */
export async function systemRoutes(app: FastifyInstance): Promise<void> {

  // health check
  app.get('/health', async (request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });
}
