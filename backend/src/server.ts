/**
 * Entry point for the backend server.
 */

// --- IMPORTS ---
import { buildApp } from './app.js';
import { config } from './config.js';

// --- CODE ---
/**
 * Start the backend server listening on the specified host and port.
 *
 * @returns {Promise<void>} A promise that resolves when the server has
 *                          started successfully.
 */
async function start(): Promise<void> {

  const app = buildApp();

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

// call the start function
start();
