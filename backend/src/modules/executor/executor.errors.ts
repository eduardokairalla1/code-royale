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
 * Raised for a language with no sandbox runtime: a bug, not a player error.
 */
export class UnsupportedRuntimeError extends AppError {
  static override readonly MESSAGE = 'Language cannot be run!';
}
