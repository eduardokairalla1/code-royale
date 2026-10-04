/**
 * Room and player types.
 */

// --- IMPORTS ---
import type { ChallengeDifficulty } from '../challenge/challenge.types.js';
import type { PublicRound } from '../game/game.types.js';
import type { Round } from '../game/game.types.js';

// --- CODE ---
/**
 * Room lifecycle: the room outlives rounds and loops back to LOBBY.
 */
export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

/**
 * A player inside a room.
 */
export interface Player {
  id: string;
  name: string;
  token: string;
  joinedAt: number;
  socketId: string | null;
}

/**
 * A room, kept for as long as it has players.
 */
export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  players: Map<string, Player>;
  round: Round | null;
  playedChallengeIds: string[];
  // what the next rounds may draw, set by the host in the lobby
  difficulties: ChallengeDifficulty[];
  createdAt: number;
  version: number;
}

/**
 * Player as sent to clients: no token.
 */
export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

/**
 * Room as sent to clients: no tokens.
 */
export interface PublicRoom {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: PublicPlayer[];
  round: PublicRound | null;
  difficulties: ChallengeDifficulty[];
  version: number;
}
