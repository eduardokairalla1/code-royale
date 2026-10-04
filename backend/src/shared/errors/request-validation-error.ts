/**
 * Request validation error.
 */

// --- IMPORTS ---
import { AppError } from './app-error.js';

// --- CODE ---
/**
 * Raised when an input payload fails validation.
 */
export class RequestValidationError extends AppError {
  static override readonly MESSAGE = 'Bad Request!';
  static override readonly STATUS_CODE = 400;
  static override readonly LOG_LEVEL = 'warn';

  /**
   * Create the error with the list of invalid fields.
   *
   * @param {string[]} errors One "field: reason" entry per invalid field.
   */
  constructor(readonly errors: string[]) {
    super(errors);
  }

  /**
   * The invalid fields, so the client knows what to fix.
   *
   * @returns {string[]} One "field: reason" entry per invalid field.
   */
  override get responseMessage(): string[] {
    return this.errors;
  }
}
