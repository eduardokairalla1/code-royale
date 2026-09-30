/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { config } from './config.js';
import { pickLanguages } from './modules/language/language.catalog.js';
import { languageRoutes } from './modules/language/language.routes.js';
import { MemoryRoomStore } from './modules/room/memory-room.store.js';
import { roomRoutes } from './modules/room/room.routes.js';
import { RoomService } from './modules/room/room.service.js';
import { registerRoomSocket } from './modules/room/room.socket.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import { logStarted } from './shared/logging/lifecycle.js';
import { loggerOptions } from './shared/logging/logger.js';
import { registerRequestLog } from './shared/logging/request-log.js';
import { API_PREFIX } from './socket.js';
import { createSocketServer } from './socket.js';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { LogController } from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * What the app can be built with; tests swap in fakes and short timers.
 */
export interface AppOptions {
  emptyRoomTtlMs?: number;
  reconnectGraceMs?: number;
  maxPlayersPerRoom?: number;
  maxRooms?: number;
  enabledLanguages?: string[];
  logger?: boolean;
  logStream?: { write(line: string): void };
}

/**
 * Build the app with its services, error handlers, routes and sockets.
 *
 * @param {AppOptions} options Replacements for the production defaults.
 *
 * @returns {FastifyInstance} The configured Fastify instance.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {

  const app = Fastify({
    logger: options.logger === false
      ? false
      : {
        ...loggerOptions(config.logLevel, config.version, config.commit),
        ...(options.logStream && { stream: options.logStream }),
      },

    // one line per request instead, see registerRequestLog
    logController: new LogController({ disableRequestLogging: true }),
  });

  // wire the services
  const roomService = new RoomService(new MemoryRoomStore(), {
    emptyRoomTtlMs: options.emptyRoomTtlMs ?? config.emptyRoomTtlMs,
    reconnectGraceMs: options.reconnectGraceMs ?? config.reconnectGraceMs,
    maxPlayersPerRoom: options.maxPlayersPerRoom ?? config.maxPlayersPerRoom,
    maxRooms: options.maxRooms ?? config.maxRooms,
    logger: app.log,
  });

  const enabledLanguages = options.enabledLanguages ?? config.enabledLanguages;

  // what this instance runs with, once it listens; never the secrets
  app.addHook('onListen', async () => {
    logStarted(app.log, {
      addresses: app.addresses().map(({ address, port }) => {
        return `${address}:${port}`;
      }),
      languages: enabledLanguages,
      max_rooms: options.maxRooms ?? config.maxRooms,
      max_players_per_room:
        options.maxPlayersPerRoom ?? config.maxPlayersPerRoom,
    });
  });

  // one line per request, the health check aside
  registerRequestLog(app, [`${API_PREFIX}/health`]);

  // let the frontend call the api from another origin
  app.register(cors, { origin: config.corsOrigins });

  // register the error handlers
  registerErrorHandlers(app);

  // every route under the prefix, also the public path
  app.register(async (api) => {
    api.register(systemRoutes);
    api.register(roomRoutes, { roomService });
    api.register(languageRoutes, {
      languages: pickLanguages(enabledLanguages),
    });
  }, { prefix: API_PREFIX });

  // register the socket handlers
  const io = createSocketServer(app);

  registerRoomSocket(io, roomService, app.log);

  return app;
}
