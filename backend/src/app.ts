/**
 * Fastify application factory.
 */

// --- IMPORTS ---
import { config } from './config.js';
import { ChallengeService } from './modules/challenge/challenge.service.js';
import type { CodeExecutor } from './modules/executor/executor.types.js';
import { PistonExecutor } from './modules/executor/piston.executor.js';
import { GameService } from './modules/game/game.service.js';
import { registerGameSocket } from './modules/game/game.socket.js';
import { pickLanguages } from './modules/language/language.catalog.js';
import { languageRoutes } from './modules/language/language.routes.js';
import { LspService } from './modules/lsp/lsp.service.js';
import { registerLspSocket } from './modules/lsp/lsp.socket.js';
import { roomRoutes } from './modules/room/room.routes.js';
import { RoomService } from './modules/room/room.service.js';
import { registerRoomSocket } from './modules/room/room.socket.js';
import { RoomStore } from './modules/room/room.store.js';
import { DraftStore } from './modules/submission/draft.store.js';
import { SubmissionService } from './modules/submission/submission.service.js';
import {
  registerSubmissionSocket,
} from './modules/submission/submission.socket.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import { logStarted } from './shared/logging/lifecycle.js';
import { loggerOptions } from './shared/logging/logger.js';
import { registerRequestLog } from './shared/logging/request-log.js';
import { RedisConnections } from './shared/redis/redis.js';
import { Scheduler } from './shared/scheduler.js';
import { API_PREFIX } from './socket.js';
import { createSocketServer } from './socket.js';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { LogController } from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- GLOBALS ---
// how often each instance looks for due timers
const SCHEDULER_POLL_MS = 250;

// how long a timer may run before another instance runs it again
const SCHEDULER_LEASE_MS = 5 * 60 * 1000;

// a judging this much slower than the sandbox timeout counts as lost
const JUDGE_MARGIN_MS = 10_000;

// --- CODE ---
/**
 * What the app can be built with; tests swap in fakes and short timers.
 */
export interface AppOptions {
  executor?: CodeExecutor;
  challengeService?: ChallengeService;
  emptyRoomTtlMs?: number;
  reconnectGraceMs?: number;
  maxPlayersPerRoom?: number;
  maxRooms?: number;
  maxCodeLength?: number;
  maxConcurrentRuns?: number;
  enabledLanguages?: string[];
  lspSecret?: string;
  redisUrl?: string;
  redisKeyPrefix?: string;
  schedulerPollMs?: number;
  judgeTimeoutMs?: number;
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

  // shared state: every instance of the backend uses the same Redis
  const redisKeyPrefix = options.redisKeyPrefix ?? config.redisKeyPrefix;
  const redis = new RedisConnections({
    url: options.redisUrl ?? config.redisUrl,
    keyPrefix: redisKeyPrefix,
    logger: app.log,
  });

  const scheduler = new Scheduler(redis.client, {
    pollMs: options.schedulerPollMs ?? SCHEDULER_POLL_MS,
    leaseMs: SCHEDULER_LEASE_MS,
    logger: app.log,
  });

  const challengeService = options.challengeService
    ?? ChallengeService.load(config.challengesDir);

  const judgeTimeoutMs = options.judgeTimeoutMs
    ?? config.pistonTimeoutMs + JUDGE_MARGIN_MS;

  // wire the services
  const roomService = new RoomService(
    new RoomStore(redis.client, (id) => challengeService.find(id)),
    scheduler,
    {
      emptyRoomTtlMs: options.emptyRoomTtlMs ?? config.emptyRoomTtlMs,
      reconnectGraceMs: options.reconnectGraceMs ?? config.reconnectGraceMs,
      maxPlayersPerRoom:
        options.maxPlayersPerRoom ?? config.maxPlayersPerRoom,
      maxRooms: options.maxRooms ?? config.maxRooms,
      logger: app.log,
    },
  );

  const submissionService = new SubmissionService(
    roomService,
    new DraftStore(redis.client),
    options.executor
      ?? new PistonExecutor(config.pistonUrl, config.pistonTimeoutMs),
    redis.client,
    {
      maxConcurrentRuns:
        options.maxConcurrentRuns ?? config.maxConcurrentRuns,
      judgeTimeoutMs,
      logger: app.log,
    },
  );

  const gameService = new GameService(
    roomService,
    challengeService,
    submissionService,
    scheduler,
    redis.client,
    {
      // submissions in flight waited for, then the drafts judged
      finishTimeoutMs: judgeTimeoutMs * 3,
      logger: app.log,
    },
  );

  const lspSecret = options.lspSecret ?? config.lspSecret;

  const lspService = new LspService(roomService, {
    secret: lspSecret,
    ticketTtlMs: config.lspTicketTtlMs,
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
      challenges: challengeService.count,
      max_rooms: options.maxRooms ?? config.maxRooms,
      max_players_per_room:
        options.maxPlayersPerRoom ?? config.maxPlayersPerRoom,
      max_concurrent_runs:
        options.maxConcurrentRuns ?? config.maxConcurrentRuns,
      lsp: lspSecret !== undefined,
      piston: new URL(config.pistonUrl).origin,
      redis: new URL(options.redisUrl ?? config.redisUrl).host,
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

  const roomSocket = registerRoomSocket(io, roomService, app.log);
  registerGameSocket(io, gameService, app.log);
  registerSubmissionSocket(io, submissionService, app.log, {
    languageIds: enabledLanguages,
    maxCodeLength: options.maxCodeLength ?? config.maxCodeLength,
  });
  registerLspSocket(io, lspService, app.log, enabledLanguages);

  // connect before serving, then look for due timers
  app.addHook('onReady', async () => {
    await redis.connect();
    scheduler.run();
  });

  // let running timers and disconnects land before redis goes away
  app.addHook('onClose', async () => {
    await scheduler.stop();
    await roomSocket.drain();
    await redis.close();
  });

  return app;
}
