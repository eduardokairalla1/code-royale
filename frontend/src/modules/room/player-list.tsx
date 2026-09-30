/**
 * Players of a room: who is host, who is online and which one is you.
 */

// --- IMPORTS ---
import crown from '../../assets/logo.png';
import { Annotate } from '../../components/annotate/annotate.tsx';
import { SketchFrame } from '../../components/sketch-frame/sketch-frame.tsx';
import styles from './player-list.module.css';
import type { Player } from './room.types.ts';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';

// --- CODE ---
/**
 * Props of the player list.
 */
export interface PlayerListProps {
  players: Player[];
  // the player looking at the list
  selfId: string;
}

/**
 * Render the players, popping in as they join and out as they leave.
 *
 * @param {PlayerListProps} props The players and who is looking.
 *
 * @returns {JSX.Element} The list.
 */
export function PlayerList({ players, selfId }: PlayerListProps) {

  return (
    <ul className={styles.list}>
      <AnimatePresence initial={false}>
        {players.map((player, index) => (
          <motion.li
            key={player.id}
            layout
            className={styles.row}
            initial={{ opacity: 0, scale: 0.5, rotate: -6 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: index % 2 === 0 ? -0.6 : 0.6,
            }}
            exit={{ opacity: 0, scale: 0.6, x: 40 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <SketchFrame
              fill={player.isHost ? 'var(--crown)' : 'var(--paper-light)'}
              shadow={3}
            />
            <div className={styles.content}>
              <span className={styles.crownSlot}>
                {player.isHost && (
                  <motion.img
                    layoutId="host-crown"
                    src={crown}
                    alt="Host"
                    className={styles.crown}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  />
                )}
              </span>

              <span className={styles.name}>
                {player.id === selfId
                  ? (
                    <Annotate type="underline" color="var(--gem)" delay={300}>
                      {`${player.name} (you)`}
                    </Annotate>
                  )
                  : player.name}
              </span>

              <span
                className={styles.presence}
                data-online={player.connected}
                title={player.connected ? 'Online' : 'Disconnected'}
              >
                <span className={styles.dot} />
                <span className={styles.presenceLabel}>
                  {player.connected ? 'online' : 'disconnected'}
                </span>
              </span>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
