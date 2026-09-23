/**
 * Room errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when no free room code was found after several attempts.
 */
export class RoomCodeGenerationError extends AppError {
  static override readonly MESSAGE = 'Could not create the room!';
}
