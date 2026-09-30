/**
 * Application config.
 */

// --- IMPORTS ---
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// --- GLOBALS ---
// define the schema for the env vars we expect
const envSchema = z.object({

  // general
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),

  // rooms
  MAX_PLAYERS_PER_ROOM: z.coerce.number().int().positive().default(20),
  MAX_ROOMS: z.coerce.number().int().positive().default(1000),
});

// load the .env file into process.env before reading anything
loadEnv({ quiet: true });

// parse and validate the env vars
const env = parseEnv();

// build the config
export const config = {
  port: env.PORT,
  host: env.HOST,
  maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
  maxRooms: env.MAX_ROOMS,
};

// --- CODE ---
/**
 * Validate process.env against the schema, failing fast on boot.
 *
 * @returns {z.infer<typeof envSchema>} The typed env vars.
 *
 * @throws {Error} When any env var is invalid.
 */
function parseEnv(): z.infer<typeof envSchema> {

  const result = envSchema.safeParse(process.env);

  // invalid env: list every bad var and stop
  if (!result.success) {
    throw new Error(`Invalid env vars:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
