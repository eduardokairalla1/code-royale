/**
 * Hand-drawn shapes: stable seeds and paths split by paint.
 */

// --- IMPORTS ---
import { seedFrom } from '../../src/shared/sketch.ts';
import { sketchRectangle } from '../../src/shared/sketch.ts';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
describe('seedFrom', () => {

  it('gives the same positive seed for the same input', () => {
    expect(seedFrom(':r1:')).toBe(seedFrom(':r1:'));
    expect(seedFrom(':r1:')).toBeGreaterThan(0);
    expect(seedFrom(':r1:')).not.toBe(seedFrom(':r2:'));
  });
});

describe('sketchRectangle', () => {

  it('draws the same wobble for the same seed', () => {
    const options = { seed: 7, fill: true, fillStyle: 'solid' as const };

    expect(sketchRectangle(0, 0, 100, 40, options))
      .toEqual(sketchRectangle(0, 0, 100, 40, options));
  });

  it('splits fills, hatches and outlines', () => {
    const solid = sketchRectangle(0, 0, 100, 40, {
      seed: 1,
      fill: true,
      fillStyle: 'solid',
    });
    const hatched = sketchRectangle(0, 0, 100, 40, {
      seed: 1,
      fill: true,
      fillStyle: 'hachure',
    });

    expect(solid.fills).toHaveLength(1);
    expect(solid.outlines.length).toBeGreaterThan(0);
    expect(hatched.hatches.length).toBeGreaterThan(0);
  });

  it('leaves the outline out when asked, e.g. for a shadow', () => {
    const shadow = sketchRectangle(0, 0, 100, 40, {
      seed: 1,
      fill: true,
      fillStyle: 'solid',
      outline: false,
    });

    expect(shadow.outlines).toHaveLength(0);
    expect(shadow.fills).toHaveLength(1);
  });
});
