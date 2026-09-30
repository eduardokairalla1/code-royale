/**
 * Submission errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when running or submitting outside a running round.
 */
export class RoundNotRunningError extends AppError {
  static override readonly MESSAGE = 'There is no round running!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when a player who joined mid round tries to play it.
 */
export class NotInRoundError extends AppError {
  static override readonly MESSAGE = 'You are not playing this round!';
  static override readonly STATUS_CODE = 403;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised on a second submission: each player submits once per round.
 */
export class AlreadySubmittedError extends AppError {
  static override readonly MESSAGE = 'You have already submitted!';
  static override readonly STATUS_CODE = 409;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised when running the examples while the previous run is not done.
 */
export class RunInProgressError extends AppError {
  static override readonly MESSAGE = 'Wait for the current run to finish!';
  static override readonly STATUS_CODE = 429;
  static override readonly LOG_LEVEL = 'warn';
}
