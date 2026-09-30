/**
 * Language http routes.
 */

// --- IMPORTS ---
import type { Language } from './language.catalog.js';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Options received by the language routes plugin.
 */
interface LanguageRoutesOptions {
  // only the languages enabled in this deployment
  languages: Language[];
}

/**
 * Register the language routes.
 *
 * @param {FastifyInstance} app The Fastify instance.
 * @param {LanguageRoutesOptions} options The plugin options.
 *
 * @returns {Promise<void>}
 */
export async function languageRoutes(
  app: FastifyInstance,
  { languages }: LanguageRoutesOptions,
): Promise<void> {

  // languages players can pick, with the editor's starting code
  app.get('/languages', async (request, reply) => {
    return reply.status(200).send(languages);
  });
}
