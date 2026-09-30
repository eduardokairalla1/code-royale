/**
 * Code execution errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when the sandbox is down, too slow or answers something unexpected.
 */
export class ExecutorUnavailableError extends AppError {
  static override readonly MESSAGE = 'Code execution is unavailable!';
  static override readonly STATUS_CODE = 503;
}

/**
 * Raised when too many runs are already going, so one more would only wait.
 */
export class ExecutorBusyError extends AppError {
  static override readonly MESSAGE = 'Too many runs at once, try again!';
  static override readonly STATUS_CODE = 503;
  static override readonly LOG_LEVEL = 'warn';
}

/**
 * Raised for a language with no sandbox runtime: a bug, not a player error.
 */
export class UnsupportedRuntimeError extends AppError {
  static override readonly MESSAGE = 'Language cannot be run!';
}
