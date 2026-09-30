/**
 * Hand-drawn frame: a sketched box and its shadow behind any element.
 */

// --- IMPORTS ---
import { seedFrom } from '../../shared/sketch.ts';
import { sketchRectangle } from '../../shared/sketch.ts';
import type { SketchFillStyle } from '../../shared/sketch.ts';
import type { SketchPaths } from '../../shared/sketch.ts';
import styles from './sketch-frame.module.css';
import { useReducedMotion } from 'motion/react';
import type { RefObject } from 'react';
import { useEffect } from 'react';
import { useId } from 'react';
import { useMemo } from 'react';
import { useRef } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// room for the marker, so the stroke never gets clipped
const INSET = 2;

// how fast the outline wobbles while boiling, and through how many frames
const BOIL_FRAME_MS = 110;
const BOIL_FRAMES = 3;

// --- CODE ---
/**
 * Props of the sketch frame.
 */
export interface SketchFrameProps {
  // css color of the inside, none when left out
  fill?: string;
  fillStyle?: SketchFillStyle;
  // css color of the outline
  stroke?: string;
  // hard shadow offset in px, 0 for none
  shadow?: number;
  // keep redrawing the outline, like a cartoon line boil
  boil?: boolean;
  roughness?: number;
}

/**
 * Draw a sketched box filling its positioned parent.
 *
 * @param {SketchFrameProps} props How the frame looks.
 *
 * @returns {JSX.Element} The frame's svg.
 */
export function SketchFrame({
  fill,
  fillStyle = 'solid',
  stroke = 'var(--ink)',
  shadow = 0,
  boil = false,
  roughness,
}: SketchFrameProps) {

  const svgRef = useRef<SVGSVGElement>(null);
  const size = useParentSize(svgRef);
  const frame = useBoilFrame(boil);
  const baseSeed = seedFrom(useId());

  const { box, shade } = useMemo(() => {

    // not measured yet: nothing to draw
    if (size.width === 0 || size.height === 0) {
      return { box: null, shade: null };
    }

    const width = size.width - INSET * 2;
    const height = size.height - INSET * 2;
    const seed = baseSeed + frame;

    return {
      box: sketchRectangle(INSET, INSET, width, height, {
        seed,
        fill: fill !== undefined,
        fillStyle,
        roughness,
      }),
      shade: shadow > 0
        ? sketchRectangle(INSET + shadow, INSET + shadow, width, height, {
          seed: seed + 7,
          fill: true,
          fillStyle: 'solid',
          outline: false,
          roughness,
        })
        : null,
    };
  }, [size, baseSeed, frame, fill, fillStyle, shadow, roughness]);

  return (
    <svg ref={svgRef} className={styles.frame} aria-hidden="true">
      {shade && (
        <g data-sketch-shadow="">
          <SketchPathGroup paths={shade} fill="var(--ink)" />
        </g>
      )}
      {box && (
        <g data-sketch-face="" className={styles.face}>
          <SketchPathGroup paths={box} fill={fill} stroke={stroke} />
        </g>
      )}
    </svg>
  );
}

/**
 * Paint the paths of one sketched shape.
 *
 * @param {object} props The paths and their colors.
 * @param {SketchPaths} props.paths The shape's paths.
 * @param {string} props.fill Css color of fills and hatches.
 * @param {string} props.stroke Css color of the outline.
 *
 * @returns {JSX.Element} The svg paths.
 */
function SketchPathGroup({
  paths,
  fill,
  stroke,
}: {
  paths: SketchPaths;
  fill?: string;
  stroke?: string;
}) {

  return (
    <>
      {paths.fills.map((d, index) => (
        <path key={`f${index}`} d={d} style={{ fill, stroke: 'none' }} />
      ))}
      {paths.hatches.map((d, index) => (
        <path
          key={`h${index}`}
          d={d}
          className={styles.hatch}
          style={{ stroke: fill }}
        />
      ))}
      {paths.outlines.map((d, index) => (
        <path
          key={`o${index}`}
          d={d}
          className={styles.outline}
          style={{ stroke }}
        />
      ))}
    </>
  );
}

/**
 * Track the parent's layout size, ignoring transforms.
 *
 * @param {RefObject<Element | null>} ref The frame's svg.
 *
 * @returns {{ width: number, height: number }} The parent's size, in px.
 */
function useParentSize(
  ref: RefObject<Element | null>,
): { width: number; height: number } {

  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {

    const parent = ref.current?.parentElement;

    if (!parent) {
      return;
    }

    // layout size in whole px, so transforms and sub-pixels never redraw
    const measure = (): void => {
      const width = parent.offsetWidth;
      const height = parent.offsetHeight;

      setSize((current) => {
        return current.width === width && current.height === height
          ? current
          : { width, height };
      });
    };

    const observer = new ResizeObserver(measure);

    observer.observe(parent);
    measure();

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * Cycle through a few frames while boiling, like a hand-drawn cartoon.
 *
 * @param {boolean} active Whether the line is boiling.
 *
 * @returns {number} The current frame, 0 when still.
 */
function useBoilFrame(active: boolean): number {

  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const running = active && !reducedMotion;

  useEffect(() => {

    // still: keep the current drawing
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % BOIL_FRAMES);
    }, BOIL_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [running]);

  return frame;
}
