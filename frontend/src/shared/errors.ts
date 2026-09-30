/**
 * Errors from the backend, with the message players read.
 */

// --- GLOBALS ---
// backend error slug -> what the player reads
const MESSAGES: Record<string, string> = {
  room_not_found_error: 'Room not found.',
  room_full_error: 'The room is full.',
  invalid_player_token_error: 'Your session in this room expired.',
  not_host_error: 'Only the host can do that.',
  game_already_started_error: 'The match has already started.',
  game_not_finished_error: 'The round is not over yet.',
  round_not_running_error: 'There is no round in progress.',
  not_in_round_error: 'You join the next round.',
  already_submitted_error: 'You already submitted this round.',
  run_in_progress_error: 'Wait for the current run to finish.',
  executor_unavailable_error: 'Runner unavailable, try again.',
  executor_busy_error: 'Too many runs right now, try again.',
  too_many_rooms_error: 'Too many rooms open, try again later.',
  rate_limited_error: 'Too many requests, slow down.',
  request_validation_error: 'Some field is invalid.',
  network_error: 'Could not reach the server.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

// --- CODE ---
/**
 * The error envelope the backend answers with, over http and sockets.
 */
export interface ErrorBody {
  error: string;
  message: string | string[];
}

/**
 * An error answered by the backend, or a failure to reach it.
 */
export class ApiError extends Error {
  readonly slug: string;
  readonly status: number | null;

  /**
   * Create the error from its backend slug.
   *
   * @param {string} slug The backend error slug, e.g. "room_full_error".
   * @param {number | null} status The http status, null when not over http.
   */
  constructor(slug: string, status: number | null = null) {
    super(slug);
    this.name = 'ApiError';
    this.slug = slug;
    this.status = status;
  }

  /**
   * The message shown to the player.
   *
   * @returns {string} The translated message.
   */
  get userMessage(): string {
    return describeError(this.slug);
  }
}

/**
 * Tell whether a value is the backend's error envelope.
 *
 * @param {unknown} value Anything received from the backend.
 *
 * @returns {boolean} True when it has an error slug.
 */
export function isErrorBody(value: unknown): value is ErrorBody {

  return typeof value === 'object'
    && value !== null
    && typeof (value as ErrorBody).error === 'string';
}

/**
 * Describe an error slug in words the player understands.
 *
 * @param {string} slug The backend error slug.
 *
 * @returns {string} The message to show.
 */
export function describeError(slug: string): string {
  return MESSAGES[slug] ?? FALLBACK_MESSAGE;
}

/**
 * Describe anything thrown, for showing it to the player.
 *
 * @param {unknown} error The thrown value.
 *
 * @returns {string} The message to show.
 */
export function describeUnknownError(error: unknown): string {

  // ours: translated by slug
  if (error instanceof ApiError) {
    return error.userMessage;
  }

  return FALLBACK_MESSAGE;
}
