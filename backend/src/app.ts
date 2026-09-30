/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { MemoryRoomStore } from './modules/room/memory-room.store.js';
import { roomRoutes } from './modules/room/room.routes.js';
import { RoomService } from './modules/room/room.service.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * What the app can be built with; tests swap in fakes and short timers.
 */
export interface AppOptions {
  logger?: boolean;
}

/**
 * Build the application with its services, error handlers and routes.
 *
 * @param {AppOptions} options Replacements for the production defaults.
 *
 * @returns {FastifyInstance} The configured Fastify instance.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {

  const app = Fastify({
    logger: options.logger ?? true,
  });

  // wire the services
  const roomService = new RoomService(new MemoryRoomStore());

  // register the error handlers
  registerErrorHandlers(app);

  // register the routes
  app.register(systemRoutes);
  app.register(roomRoutes, { prefix: '/api', roomService });

  return app;
}
