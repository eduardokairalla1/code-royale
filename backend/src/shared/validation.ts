/**
 * Input validation. The only place that knows how schemas report errors.
 */

// --- IMPORTS ---
import { RequestValidationError } from './errors/request-validation-error.js';
import type { z } from 'zod';

// --- CODE ---
/**
 * Build one "field -> subfield: reason" entry per invalid field.
 *
 * @param {z.ZodError} error The schema error.
 *
 * @returns {string[]} One entry per invalid field.
 */
function formatValidationErrors(error: z.ZodError): string[] {

  return error.issues.map((issue) => {

    // issue on the whole payload: no field to prefix
    if (issue.path.length === 0) {
      return issue.message;
    }

    return `${issue.path.map(String).join(' -> ')}: ${issue.message}`;
  });
}

/**
 * Validate untrusted input against a schema.
 *
 * @param {T} schema The schema the input must match.
 * @param {unknown} data The untrusted input.
 *
 * @returns {z.output<T>} The validated, transformed input.
 *
 * @throws {RequestValidationError} When the input is invalid.
 */
export function parseInput<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {

  const result = schema.safeParse(data);

  // invalid input: report every bad field
  if (!result.success) {
    throw new RequestValidationError(formatValidationErrors(result.error));
  }

  return result.data;
}
