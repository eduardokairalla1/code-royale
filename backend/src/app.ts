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
 * Build the application with its services, error handlers and routes.
 *
 * @returns {FastifyInstance} The configured Fastify instance.
 */
export function buildApp(): FastifyInstance {

  const app = Fastify({
    logger: true,
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
