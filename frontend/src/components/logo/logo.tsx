/**
 * Code Royale logo: the crown drops in, the name pops up.
 */

// --- IMPORTS ---
import crown from '../../assets/logo.png';
import styles from './logo.module.css';
import { motion } from 'motion/react';

// --- GLOBALS ---
const WORDS = ['Code', 'Royale'];

// every letter with the delay it pops in with, after the crown lands
const LETTERS = WORDS.map((word, wordIndex) => {
  const before = WORDS.slice(0, wordIndex).join('').length;

  return [...word].map((letter, index) => ({
    letter,
    delay: 0.35 + (before + index) * 0.04,
  }));
});

// a little shake when hovered
const CROWN_HOVER = {
  rotate: [0, -10, 10, -5, 0],
  transition: { duration: 0.5 },
};

// --- CODE ---
/**
 * Props of the logo.
 */
export interface LogoProps {
  size?: 'sm' | 'lg';
}

/**
 * Render the crown and the name.
 *
 * @param {LogoProps} props The logo's size.
 *
 * @returns {JSX.Element} The logo.
 */
export function Logo({ size = 'lg' }: LogoProps) {

  return (
    <div className={`${styles.logo} ${styles[size]}`}>
      <motion.img
        src={crown}
        alt=""
        className={styles.crown}
        initial={{ y: -140, rotate: -25, opacity: 0 }}
        animate={{ y: 0, rotate: [-25, 12, -6, 0], opacity: 1 }}
        transition={{
          y: { type: 'spring', stiffness: 380, damping: 11 },
          rotate: { duration: 0.9, times: [0, 0.4, 0.7, 1] },
          opacity: { duration: 0.15 },
        }}
        whileHover={CROWN_HOVER}
      />
      <h1 className={styles.name} aria-label={WORDS.join(' ')}>
        {LETTERS.map((letters, wordIndex) => (
          <span key={wordIndex} className={styles.word} aria-hidden="true">
            {letters.map(({ letter, delay }, index) => (
              <motion.span
                key={index}
                className={styles.letter}
                initial={{ y: 24, scale: 0.4, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 14,
                  delay,
                }}
              >
                {letter}
              </motion.span>
            ))}
          </span>
        ))}
      </h1>
    </div>
  );
}
