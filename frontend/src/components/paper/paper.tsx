/**
 * Hand-drawn sheet of paper that holds a block of content.
 */

// --- IMPORTS ---
import { SketchFrame } from '../sketch-frame/sketch-frame.tsx';
import styles from './paper.module.css';
import type { HTMLAttributes } from 'react';

// --- CODE ---
/**
 * Props of the paper.
 */
export interface PaperProps extends HTMLAttributes<HTMLDivElement> {
  // css color of the sheet
  fill?: string;
  shadow?: number;
}

/**
 * Render content on a sketched sheet.
 *
 * @param {PaperProps} props The sheet's look and native div props.
 *
 * @returns {JSX.Element} The sheet.
 */
export function Paper({
  fill = 'var(--paper-light)',
  shadow = 6,
  className,
  children,
  ...props
}: PaperProps) {

  return (
    <div {...props} className={`${styles.paper} ${className ?? ''}`}>
      <SketchFrame fill={fill} shadow={shadow} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
