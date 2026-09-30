/**
 * Short notices stuck to the corner like sticky notes, gone by themselves.
 */

// --- IMPORTS ---
import styles from './toast-stack.module.css';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect } from 'react';

// --- GLOBALS ---
// how long a notice stays up
const TOAST_MS = 3200;

// --- CODE ---
/**
 * One notice.
 */
export interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'crown';
}

/**
 * Props of the toast stack.
 */
export interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/**
 * Render the notices, newest at the bottom.
 *
 * @param {ToastStackProps} props The notices and how to drop one.
 *
 * @returns {JSX.Element} The stack.
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {

  return (
    <ol className={styles.stack} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast, index) => (
          <ToastNote
            key={toast.id}
            toast={toast}
            tilt={index % 2 === 0 ? -2 : 1.5}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </ol>
  );
}

/**
 * One sticky note, dismissed after a moment or on click.
 *
 * @param {object} props The notice, its tilt and how to drop it.
 * @param {Toast} props.toast The notice.
 * @param {number} props.tilt Its rotation, in degrees.
 * @param {(id: number) => void} props.onDismiss Drops it.
 *
 * @returns {JSX.Element} The note.
 */
function ToastNote({
  toast,
  tilt,
  onDismiss,
}: {
  toast: Toast;
  tilt: number;
  onDismiss: (id: number) => void;
}) {

  // gone by itself after a moment
  useEffect(() => {

    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_MS);

    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.li
      layout
      className={styles.note}
      data-tone={toast.tone ?? 'info'}
      initial={{ opacity: 0, x: 80, rotate: 10 }}
      animate={{ opacity: 1, x: 0, rotate: tilt }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.text}
    </motion.li>
  );
}
