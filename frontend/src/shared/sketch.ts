/**
 * Hand-drawn shapes: svg paths that look sketched with a marker.
 */

// --- IMPORTS ---
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';

// --- GLOBALS ---
// one generator for every shape: it only builds paths, never draws
const generator = rough.generator();

// the marker every shape is drawn with
const BASE_OPTIONS: Options = {
  roughness: 1.1,
  bowing: 0.8,
  strokeWidth: 2.5,
  hachureGap: 7,
  fillWeight: 1.6,
};

// --- CODE ---
/**
 * How a shape is filled: flat color or marker hatching.
 */
export type SketchFillStyle = 'solid' | 'hachure' | 'cross-hatch';

/**
 * The svg paths of one sketched shape, split by how they are painted.
 */
export interface SketchPaths {
  // painted with the fill color
  fills: string[];
  // hatching strokes, painted with the fill color
  hatches: string[];
  // the outline, painted with the ink color
  outlines: string[];
}

/**
 * What a sketched shape looks like.
 */
export interface SketchOptions {
  seed: number;
  fill: boolean;
  fillStyle: SketchFillStyle;
  roughness?: number;
  outline?: boolean;
}

/**
 * Turn a string into a stable seed, so a shape keeps its wobble.
 *
 * @param {string} value Anything unique to the shape, e.g. a react id.
 *
 * @returns {number} A positive integer seed.
 */
export function seedFrom(value: string): number {

  let hash = 0;

  // simple string hash, good enough to spread the seeds
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }

  return (Math.abs(hash) % 2_000_000) + 1;
}

/**
 * Sketch a rectangle.
 *
 * @param {number} x Left edge.
 * @param {number} y Top edge.
 * @param {number} width Its width.
 * @param {number} height Its height.
 * @param {SketchOptions} options How it looks.
 *
 * @returns {SketchPaths} The paths to paint.
 */
export function sketchRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  options: SketchOptions,
): SketchPaths {

  const drawable = generator.rectangle(x, y, width, height, {
    ...BASE_OPTIONS,
    seed: options.seed,
    roughness: options.roughness ?? BASE_OPTIONS.roughness,
    stroke: options.outline === false ? 'none' : 'ink',
    fill: options.fill ? 'fill' : undefined,
    fillStyle: options.fillStyle,
  });

  const paths: SketchPaths = { fills: [], hatches: [], outlines: [] };

  // colors are applied by the caller, so only the geometry matters here
  for (const set of drawable.sets) {
    const d = generator.opsToPath(set, 2);

    if (set.type === 'fillPath') {
      paths.fills.push(d);
    } else if (set.type === 'fillSketch') {
      paths.hatches.push(d);
    } else {
      paths.outlines.push(d);
    }
  }

  return paths;
}
