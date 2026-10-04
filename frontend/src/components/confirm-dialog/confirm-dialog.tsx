/**
 * Confirmation dialog on a sketched sheet, for actions that cannot be undone.
 */

// --- IMPORTS ---
import { Button } from '../button/button.tsx';
import { SketchFrame } from '../sketch-frame/sketch-frame.tsx';
import styles from './confirm-dialog.module.css';
import { motion } from 'motion/react';
import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';

// --- CODE ---
/**
 * Props of the confirmation dialog.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Ask the player to confirm an action.
 *
 * @param {ConfirmDialogProps} props The question, labels and callbacks.
 *
 * @returns {JSX.Element} The dialog, rendered only while open.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.content}>
          <motion.div
            className={styles.sheet}
            initial={{ scale: 0.7, rotate: -4, opacity: 0 }}
            animate={{ scale: 1, rotate: -1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          >
            <SketchFrame fill="var(--paper-light)" shadow={6} />
            <div className={styles.body}>
              <AlertDialog.Title className={styles.title}>
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className={styles.text}>
                {children}
              </AlertDialog.Description>
              <div className={styles.actions}>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary">{cancelLabel}</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button onClick={onConfirm}>{confirmLabel}</Button>
                </AlertDialog.Action>
              </div>
            </div>
          </motion.div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
