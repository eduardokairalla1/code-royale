/**
 * Submitted code cache: one request per player, failures retried.
 */

// --- IMPORTS ---
import {
  createSubmissionCache,
} from '../../src/modules/game/submission-cache.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- GLOBALS ---
const DRAFT = { language: 'python', code: 'print(1)' };

// --- CODE ---
describe('createSubmissionCache', () => {

  it('asks the server once per player', async () => {
    const fetchCode = vi.fn().mockResolvedValue(DRAFT);
    const cache = createSubmissionCache(fetchCode);

    await expect(cache.get('ana')).resolves.toEqual(DRAFT);
    await expect(cache.get('ana')).resolves.toEqual(DRAFT);
    await cache.get('bob');

    expect(fetchCode.mock.calls).toEqual([['ana'], ['bob']]);
  });

  it('asks again after a failure', async () => {
    const fetchCode = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(DRAFT);
    const cache = createSubmissionCache(fetchCode);

    await expect(cache.get('ana')).rejects.toThrow('down');
    await expect(cache.get('ana')).resolves.toEqual(DRAFT);

    expect(fetchCode).toHaveBeenCalledTimes(2);
  });
});
