/**
 * Room errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when no room matches the given code.
 */
export class RoomNotFoundError extends AppError {
  static override readonly MESSAGE = 'Room not found!';
  static override readonly STATUS_CODE = 404;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when joining a room whose game is running.
 */
export class RoomInGameError extends AppError {
  static override readonly MESSAGE = 'The game has already started!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when joining a room that reached the player limit.
 */
export class RoomFullError extends AppError {
  static override readonly MESSAGE = 'The room is full!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when the server already holds as many rooms as it may.
 */
export class TooManyRoomsError extends AppError {
  static override readonly MESSAGE = 'Too many rooms open, try again later!';
  static override readonly STATUS_CODE = 503;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when no free room code was found after several attempts.
 */
export class RoomCodeGenerationError extends AppError {
  static override readonly MESSAGE = 'Could not create the room!';
}

/**
 * Raised when a token does not belong to any player of the room.
 */
export class InvalidPlayerTokenError extends AppError {
  static override readonly MESSAGE = 'Invalid player token!';
  static override readonly STATUS_CODE = 401;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when someone other than the host tries a host-only action.
 */
export class NotHostError extends AppError {
  static override readonly MESSAGE = 'Only the host can do this!';
  static override readonly STATUS_CODE = 403;
  static override readonly LOG_LEVEL = 'warn';
}
