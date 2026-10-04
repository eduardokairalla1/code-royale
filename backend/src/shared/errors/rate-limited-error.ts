/**
 * Rate limited error.
 */

// --- IMPORTS ---
import { AppError } from './app-error.js';

// --- CODE ---
/**
 * Raised when a client sends more events than it may.
 */
export class RateLimitedError extends AppError {
  static override readonly MESSAGE = 'Too many requests, slow down!';
  static override readonly STATUS_CODE = 429;
  static override readonly LOG_LEVEL = 'warn';
}
