/**
 * Game errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when starting a round outside the lobby.
 */
export class GameAlreadyStartedError extends AppError {
  static override readonly MESSAGE = 'The game has already started!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when going back to the lobby before the round is over.
 */
export class GameNotFinishedError extends AppError {
  static override readonly MESSAGE = 'The round is not over yet!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}
