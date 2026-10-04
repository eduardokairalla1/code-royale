/**
 * The host's pick of difficulties.
 */

// --- IMPORTS ---
import {
  toggleDifficulty,
} from '../../src/modules/room/room.difficulties.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('toggleDifficulty', () => {

  it('turns one off', () => {
    expect(toggleDifficulty(['easy', 'medium', 'hard'], 'medium'))
      .toEqual(['easy', 'hard']);
  });

  it('turns one on, keeping the easiest first', () => {
    expect(toggleDifficulty(['hard'], 'easy')).toEqual(['easy', 'hard']);
  });

  it('never leaves none', () => {
    expect(toggleDifficulty(['medium'], 'medium')).toBeNull();
  });
});
