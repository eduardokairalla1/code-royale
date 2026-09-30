/**
 * Full screen notice: a big word, a line of text and a way out.
 */

// --- IMPORTS ---
import { Paper } from '../paper/paper.tsx';
import styles from './notice.module.css';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

// --- CODE ---
/**
 * Props of the notice.
 */
export interface NoticeProps {
  title: string;
  children?: ReactNode;
  // buttons under the text
  actions?: ReactNode;
}

/**
 * Render a notice in the middle of the page.
 *
 * @param {NoticeProps} props The title, text and actions.
 *
 * @returns {JSX.Element} The notice.
 */
export function Notice({ title, children, actions }: NoticeProps) {

  return (
    <main className={styles.page}>
      <motion.div
        className={styles.card}
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: -1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 15 }}
      >
        <Paper>
          <div className={styles.content}>
            <h2 className={styles.title}>{title}</h2>
            {children && <div className={styles.text}>{children}</div>}
            {actions && <div className={styles.actions}>{actions}</div>}
          </div>
        </Paper>
      </motion.div>
    </main>
  );
}
