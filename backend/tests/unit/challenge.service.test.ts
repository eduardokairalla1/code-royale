/**
 * Challenge catalog: loading and picking.
 */

// --- IMPORTS ---
import {
  ChallengeService,
} from '../../src/modules/challenge/challenge.service.js';
import { mkdtempSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
const FIXTURES = new URL('../fixtures/challenges/', import.meta.url);

// --- CODE ---
/**
 * Write challenge files into a fresh temporary directory.
 *
 * @param {Record<string, unknown>} files File name -> json content.
 *
 * @returns {URL} The directory, ending in a slash.
 */
function directoryWith(files: Record<string, unknown>): URL {

  const directory = mkdtempSync(join(tmpdir(), 'challenges-'));

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), JSON.stringify(content));
  }

  return pathToFileURL(`${directory}/`);
}

describe('ChallengeService.load', () => {

  it('refuses an invalid file, naming it', () => {
    const directory = directoryWith({ 'broken.json': { id: 'broken' } });

    expect(() => ChallengeService.load(directory)).toThrow(/broken\.json/);
  });

  it('refuses repeated ids', () => {
    const challenge = {
      id: 'same',
      title: 't',
      description: 'd',
      difficulty: 'easy',
      timeLimitSeconds: 1,
      examples: [{ input: '', output: '' }],
      tests: [{ input: '', output: '' }],
    };

    const directory = directoryWith({
      'a.json': challenge,
      'b.json': challenge,
    });

    expect(() => ChallengeService.load(directory)).toThrow(/Duplicated/);
  });

  it('refuses an empty catalog', () => {
    expect(() => ChallengeService.load(directoryWith({}))).toThrow(/No/);
  });
});

describe('ChallengeService.pickRandom', () => {

  const service = ChallengeService.load(FIXTURES);

  it('avoids the challenges already played', () => {
    for (let i = 0; i < 20; i++) {
      expect(service.pickRandom(['alpha']).id).toBe('beta');
    }
  });

  it('repeats once every challenge was played', () => {
    expect(['alpha', 'beta']).toContain(
      service.pickRandom(['alpha', 'beta']).id,
    );
  });
});
