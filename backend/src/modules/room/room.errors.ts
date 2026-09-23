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
 * Raised when no free room code was found after several attempts.
 */
export class RoomCodeGenerationError extends AppError {
  static override readonly MESSAGE = 'Could not create the room!';
}
