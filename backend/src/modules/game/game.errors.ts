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
