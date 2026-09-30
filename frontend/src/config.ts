/**
 * Application config, read from the vite env vars.
 */

// --- IMPORTS ---
import * as z from 'zod/mini';

// --- GLOBALS ---
// the backend's prefix, also its public path
const API_PREFIX = '/api';

// define the schema for the env vars we expect
const envSchema = z.object({

  // the backend's origin, e.g. http://localhost:3000; unset, the page's
  VITE_API_URL: z.optional(z.url()),
});

// parse and validate the env vars
const env = parseEnv();

// the backend's origin; empty is the page's own
const apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : '';

// build the config
export const config = {
  apiUrl: apiOrigin + API_PREFIX,
};

// --- CODE ---
/**
 * Validate the vite env vars against the schema, failing fast on load.
 *
 * @returns {z.infer<typeof envSchema>} The typed env vars.
 *
 * @throws {Error} When any env var is invalid.
 */
function parseEnv(): z.infer<typeof envSchema> {

  // a var set but empty, e.g. a docker build arg left out, counts as unset
  const set = Object.fromEntries(
    Object.entries(import.meta.env).filter(([, value]) => value !== ''),
  );

  const result = envSchema.safeParse(set);

  // invalid env: list every bad var and stop
  if (!result.success) {
    throw new Error(`Invalid env vars:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
