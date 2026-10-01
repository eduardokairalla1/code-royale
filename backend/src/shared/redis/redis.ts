/**
 * Connections to Redis: commands, and the pair the socket adapter needs.
 */

// --- IMPORTS ---
import { describeError } from '../logging/error-fields.js';
import { Event } from '../logging/events.js';
import { log } from '../logging/events.js';
import type { FastifyBaseLogger } from 'fastify';
import { createClient } from 'redis';

// --- CODE ---
/**
 * A connected Redis client.
 */
export type RedisClient = ReturnType<typeof createClient>;

/**
 * Where Redis is and how this app's keys are told apart.
 */
export interface RedisOptions {
  url: string;
  keyPrefix: string;
  logger: FastifyBaseLogger;
}

/**
 * Every connection the app keeps to Redis.
 */
export class RedisConnections {

  // keys and scripts
  readonly client: RedisClient;

  // pub/sub for the socket adapter
  readonly publisher: RedisClient;
  readonly subscriber: RedisClient;

  /**
   * Create the clients, not connected yet.
   *
   * @param {RedisOptions} options Where Redis is and the key prefix.
   */
  constructor(readonly options: RedisOptions) {
    this.client = createClient({
      url: options.url,
      keyPrefix: options.keyPrefix,
    });

    // create the publisher and subscriber
    this.publisher = createClient({ url: options.url });
    this.subscriber = this.publisher.duplicate();

    // watch for lost connections and log them
    watch(this.client, 'client', options.logger);
    watch(this.publisher, 'publisher', options.logger);
    watch(this.subscriber, 'subscriber', options.logger);
  }

  /**
   * Connect every client.
   *
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {

    await Promise.all([
      this.client.connect(),
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);
  }

  /**
   * Close every client that is open.
   *
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {

    const open = [this.client, this.publisher, this.subscriber]
      .filter((client) => client.isOpen);

    await Promise.all(open.map((client) => client.close()));
  }
}

/**
 * Log when a client loses redis and when it is back, once each time.
 *
 * @param {RedisClient} client The client.
 * @param {string} name Which client, for the logs.
 * @param {FastifyBaseLogger} logger Where to log.
 *
 * @returns {void}
 */
function watch(
  client: RedisClient,
  name: string,
  logger: FastifyBaseLogger,
): void {

  let down = false;

  // without a listener, a lost connection would crash the process
  client.on('error', (error: unknown) => {
    if (!down) {
      down = true;
      log(logger, 'error', Event.RedisDown, {
        client: name,
        ...describeError(error).fields,
      });
    }
  });

  client.on('ready', () => {
    if (down) {
      down = false;
      log(logger, 'info', Event.RedisUp, { client: name });
    }
  });
}
