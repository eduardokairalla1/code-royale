/**
 * One log event per http request.
 */

// --- IMPORTS ---
import { Event } from './events.js';
import { WideEvent } from './wide-event.js';
import type { FastifyInstance } from 'fastify';

// --- GLOBALS ---
declare module 'fastify' {
  interface FastifyRequest {
    // routes and the error handler add to it; logged once answered
    wideEvent: WideEvent | null;
  }
}

// --- CODE ---
/**
 * Log every request once answered, except the skipped routes.
 *
 * @param {FastifyInstance} app The Fastify instance.
 * @param {string[]} skipped Routes never logged, e.g. the health check.
 *
 * @returns {void}
 */
export function registerRequestLog(
  app: FastifyInstance,
  skipped: string[],
): void {

  app.decorateRequest('wideEvent', null);

  app.addHook('onRequest', async (request) => {
    request.wideEvent = new WideEvent().set({
      request_id: request.id,
      method: request.method,
      // no query string: it is not ours to log
      path: request.url.split('?')[0],
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url;

    if (!request.wideEvent || (route && skipped.includes(route))) {
      return;
    }

    request.wideEvent
      .set({ route: route ?? null, status: reply.statusCode })
      .emit(app.log, Event.Request);
  });
}
