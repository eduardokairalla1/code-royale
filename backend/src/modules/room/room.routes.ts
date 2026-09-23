/**
 * Room http routes.
 */

// --- IMPORTS ---
import { parseInput } from '../../shared/validation.js';
import type { JoinResult } from './room.service.js';
import type { RoomService } from './room.service.js';
import { toPublicRoom } from './room.utils.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// --- GLOBALS ---
const nameBodySchema = z.object({
  name: z.string().trim().min(1).max(20),
});

const roomParamsSchema = z.object({
  code: z.string().trim().min(1).max(10),
});

// --- CODE ---
/**
 * Options received by the room routes plugin.
 */
interface RoomRoutesOptions {
  roomService: RoomService;
}

/**
 * Build the join response: the token only goes to the player themself.
 *
 * @param {JoinResult} result The room and the player that entered it.
 *
 * @returns The public room plus the player's id and token.
 */
function toJoinResponse({ room, player }: JoinResult) {

  return {
    room: toPublicRoom(room),
    player: {
      id: player.id,
      token: player.token,
    },
  };
}

/**
 * Register the room routes.
 *
 * @param {FastifyInstance} app The Fastify instance.
 * @param {RoomRoutesOptions} options The plugin options.
 *
 * @returns {Promise<void>}
 */
export async function roomRoutes(
  app: FastifyInstance,
  { roomService }: RoomRoutesOptions,
): Promise<void> {

  // create a room, the caller becomes the host
  app.post('/rooms', async (request, reply) => {
    const { name } = parseInput(nameBodySchema, request.body);

    const result = await roomService.create(name);

    return reply.status(201).send(toJoinResponse(result));
  });

  // look up a room, e.g. before showing the join screen
  app.get('/rooms/:code', async (request, reply) => {
    const { code } = parseInput(roomParamsSchema, request.params);

    const room = await roomService.getOrThrow(code);

    return reply.status(200).send(toPublicRoom(room));
  });

  // join an existing room
  app.post('/rooms/:code/join', async (request, reply) => {
    const { code } = parseInput(roomParamsSchema, request.params);
    const { name } = parseInput(nameBodySchema, request.body);

    const result = await roomService.join(code, name);

    return reply.status(200).send(toJoinResponse(result));
  });
}
