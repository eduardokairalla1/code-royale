/**
 * Hand-drawn text field with its label and error.
 */

// --- IMPORTS ---
import { SketchFrame } from '../sketch-frame/sketch-frame.tsx';
import styles from './text-field.module.css';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { useState } from 'react';

// --- CODE ---
/**
 * Props of the text field.
 */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  // big, centered letters, e.g. for a room code
  code?: boolean;
}

/**
 * Render a labelled, sketched text input.
 *
 * @param {TextFieldProps} props The label, error and native input props.
 *
 * @returns {JSX.Element} The field.
 */
export function TextField({
  label,
  error,
  code = false,
  className,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {

  const id = useId();
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.box}>
        <SketchFrame
          fill="var(--paper-light)"
          stroke={error ? 'var(--danger)' : 'var(--ink)'}
          shadow={focused ? 4 : 0}
        />
        <input
          {...props}
          id={id}
          className={`${styles.input} ${code ? styles.code : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            key={error}
            id={errorId}
            className={styles.error}
            role="alert"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [6, -4, 2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
