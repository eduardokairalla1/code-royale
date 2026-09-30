/**
 * Token check.
 */

// --- IMPORTS ---
import { generateToken } from '../../src/shared/ids.js';
import { tokensMatch } from '../../src/shared/ids.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('tokensMatch', () => {

  it('matches only the same token', () => {
    const token = generateToken();

    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token, generateToken())).toBe(false);
  });

  it('handles tokens of any length', () => {
    expect(tokensMatch('abc', 'abcd')).toBe(false);
    expect(tokensMatch('abc', '')).toBe(false);
  });
});
