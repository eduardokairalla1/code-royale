/**
 * Connections to Redis: commands, and the pair the socket adapter needs.
 */

// --- IMPORTS ---
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
