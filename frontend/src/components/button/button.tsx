/**
 * Hand-drawn button: sinks into its shadow when pressed.
 */

// --- IMPORTS ---
import { SketchFrame } from '../sketch-frame/sketch-frame.tsx';
import styles from './button.module.css';
import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

// --- GLOBALS ---
// fill of each variant
const FILLS: Record<ButtonVariant, string> = {
  primary: 'var(--crown)',
  secondary: 'var(--paper-light)',
  danger: 'var(--gem)',
};

// squash and stretch on tap
const TAP = { scaleX: 1.05, scaleY: 0.92 };

// --- CODE ---
/**
 * What the button is for: the main action, a side one or a risky one.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/**
 * Props of the button.
 */
export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
}

/**
 * Render a sketched button.
 *
 * @param {ButtonProps} props The button's look and native props.
 *
 * @returns {JSX.Element} The button.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {

  const [hovered, setHovered] = useState(false);

  const classes = [
    styles.button,
    styles[size],
    block ? styles.block : '',
    className ?? '',
  ].join(' ');

  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled}
      className={classes}
      whileTap={disabled ? undefined : TAP}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <SketchFrame
        fill={disabled ? 'var(--ink-soft)' : FILLS[variant]}
        fillStyle={disabled ? 'hachure' : 'solid'}
        shadow={disabled ? 0 : 4}
        boil={hovered && !disabled}
      />
      <span data-sketch-face="" className={styles.label}>
        {children}
      </span>
    </motion.button>
  );
}
