/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { config } from './config.js';
import { MemoryRoomStore } from './modules/room/memory-room.store.js';
import { roomRoutes } from './modules/room/room.routes.js';
import { RoomService } from './modules/room/room.service.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * What the app can be built with; tests swap in fakes and short timers.
 */
export interface AppOptions {
  maxPlayersPerRoom?: number;
  maxRooms?: number;
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
  const roomService = new RoomService(new MemoryRoomStore(), {
    maxPlayersPerRoom: options.maxPlayersPerRoom ?? config.maxPlayersPerRoom,
    maxRooms: options.maxRooms ?? config.maxRooms,
  });

  // let the frontend call the api from another origin
  app.register(cors, { origin: config.corsOrigins });

  // register the error handlers
  registerErrorHandlers(app);

  // every route under the prefix, also the public path
  app.register(async (api) => {
    api.register(systemRoutes);
    api.register(roomRoutes, { roomService });
  }, { prefix: '/api' });

  return app;
}
