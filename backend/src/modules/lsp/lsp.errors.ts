/**
 * Language server errors.
 */

// --- IMPORTS ---
import { AppError } from '../../shared/errors/app-error.js';

// --- CODE ---
/**
 * Raised when asking for a ticket while language servers are turned off.
 */
export class LspUnavailableError extends AppError {
  static override readonly MESSAGE = 'Autocomplete is unavailable!';
  static override readonly STATUS_CODE = 503;
  static override readonly LOG_LEVEL = 'warn';
}
