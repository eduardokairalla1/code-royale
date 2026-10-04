/**
 * Marker notes drawn over text: circles, underlines, highlights.
 */

// --- IMPORTS ---
import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { annotate } from 'rough-notation';
import type { RoughAnnotationType } from 'rough-notation/lib/model';

// --- CODE ---
/**
 * Props of the annotation.
 */
export interface AnnotateProps {
  type: RoughAnnotationType;
  children: ReactNode;
  // css color of the marker
  color?: string;
  // draw it only while true
  show?: boolean;
  // wait before drawing, in ms
  delay?: number;
  strokeWidth?: number;
  padding?: number;
}

/**
 * Wrap some text and draw a marker note over it.
 *
 * @param {AnnotateProps} props The note's look and the text it marks.
 *
 * @returns {JSX.Element} The wrapped text.
 */
export function Annotate({
  type,
  children,
  color = 'var(--crown-dark)',
  show = true,
  delay = 0,
  strokeWidth = 2.5,
  padding = 4,
}: AnnotateProps) {

  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {

    const element = ref.current;

    if (!element || !show) {
      return;
    }

    const annotation = annotate(element, {
      type,
      color: resolveColor(element, color),
      strokeWidth,
      padding,
      animate: !reducedMotion,
      animationDuration: 600,
      multiline: true,
    });

    const timer = window.setTimeout(() => annotation.show(), delay);

    return () => {
      window.clearTimeout(timer);
      annotation.remove();
    };
  }, [type, color, show, delay, strokeWidth, padding, reducedMotion]);

  return <span ref={ref}>{children}</span>;
}

/**
 * Resolve a css variable color, since svg attributes cannot read them.
 *
 * @param {HTMLElement} element Where the variable is read from.
 * @param {string} color A css color, e.g. "var(--crown)".
 *
 * @returns {string} The plain color.
 */
function resolveColor(element: HTMLElement, color: string): string {

  const variable = /^var\((--[\w-]+)\)$/.exec(color.trim())?.[1];

  // already a plain color
  if (!variable) {
    return color;
  }

  return getComputedStyle(element).getPropertyValue(variable).trim() || color;
}
