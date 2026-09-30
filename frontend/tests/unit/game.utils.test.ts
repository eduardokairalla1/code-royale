/**
 * Round helpers: clocks.
 */

// --- IMPORTS ---
import { formatClock } from '../../src/modules/game/game.utils.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('formatClock', () => {

  it('shows minutes and padded seconds', () => {
    expect(formatClock(247_000)).toBe('4:07');
    expect(formatClock(60_000)).toBe('1:00');
  });

  it('rounds partial seconds up, so zero only shows at the end', () => {
    expect(formatClock(100)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });

  it('never goes negative', () => {
    expect(formatClock(-5000)).toBe('0:00');
  });
});
