/**
 * Entry point for the backend server.
 */

// --- IMPORTS ---
import { buildApp } from './app.js';
import { config } from './config.js';
import type { FastifyInstance } from 'fastify';

// --- CODE ---
/**
 * Start the backend server listening on the specified host and port.
 *
 * @returns {Promise<void>} A promise that resolves when the server has
 *                          started successfully.
 */
async function start(): Promise<void> {

  const app = buildApp();

  // close cleanly on SIGTERM or SIGINT; a second one kills right away
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void stop(app, signal);
    });
  }

  // start the server
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

  // errors occurred while starting the server: log them and exit the process
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

/**
 * Stop the server: refuse new connections and finish in flight requests.
 *
 * @param {FastifyInstance} app The running Fastify instance.
 * @param {NodeJS.Signals} signal The signal that asked for it.
 *
 * @returns {Promise<void>}
 */
async function stop(
  app: FastifyInstance,
  signal: NodeJS.Signals,
): Promise<void> {

  // closed: exit with success
  try {
    await app.close();
    process.exit(0);

  // failed to close: log it and exit with an error
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// call the start function
start();
