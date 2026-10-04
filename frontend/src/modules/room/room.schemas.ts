/**
 * Validation of what the player types before it reaches the backend.
 */

// --- IMPORTS ---
import * as z from 'zod/mini';

// --- GLOBALS ---
// same limits the backend applies
const nameSchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Type your name.'),
  z.maxLength(20, 'At most 20 letters.'),
);

const codeSchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Type the room code.'),
  z.maxLength(10, 'That code is too long.'),
);

// --- CODE ---
/**
 * A validated value, or the reason it is invalid.
 */
export type Checked = { value: string; error: null }
  | { value: null; error: string };

/**
 * Check a player name.
 *
 * @param {string} name What the player typed.
 *
 * @returns {Checked} The trimmed name, or why it is invalid.
 */
export function checkName(name: string): Checked {
  return check(nameSchema, name);
}

/**
 * Check a room code.
 *
 * @param {string} code What the player typed.
 *
 * @returns {Checked} The trimmed code, or why it is invalid.
 */
export function checkCode(code: string): Checked {
  return check(codeSchema, code);
}

/**
 * Validate a value against a schema, keeping the first issue.
 *
 * @param {z.ZodMiniType<string>} schema The schema.
 * @param {string} value The value.
 *
 * @returns {Checked} The parsed value, or the first issue's message.
 */
function check(schema: z.ZodMiniType<string>, value: string): Checked {

  const result = schema.safeParse(value);

  // invalid: the first message is enough for one field
  if (!result.success) {
    return { value: null, error: result.error.issues[0]?.message ?? '' };
  }

  return { value: result.data, error: null };
}
