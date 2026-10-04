/**
 * Room types, as the backend sends them.
 */

// --- CODE ---
/**
 * Room lifecycle: the room outlives rounds and loops back to LOBBY.
 */
export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

/**
 * A player of the room.
 */
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

/**
 * How hard a challenge is.
 */
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * An input and the output expected for it.
 */
export interface ChallengeCase {
  input: string;
  output: string;
}

/**
 * The challenge of a round, without its hidden tests.
 */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  timeLimitSeconds: number;
  examples: ChallengeCase[];
}

/**
 * How a player is doing in the round.
 */
export interface PlayerResult {
  playerId: string;
  // 1-based, null until the player submits
  position: number | null;
  submittedAt: number | null;
  passed: number | null;
  total: number | null;
  percentage: number | null;
  autoSubmitted: boolean;
}

/**
 * The current or last round of the room.
 */
export interface Round {
  challenge: Challenge;
  startedAt: number;
  endsAt: number;
  // server clock when the state was built, to correct clock drift
  serverNow: number;
  // ranked: best first, players who have not submitted last
  results: PlayerResult[];
}

/**
 * A room, as broadcast on every change.
 */
export interface Room {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: Player[];
  round: Round | null;
  // bumped on every change; a lower one is a state that arrived late
  version: number;
}

/**
 * Who the player is in a room: kept to reconnect after a reload.
 */
export interface Session {
  playerId: string;
  token: string;
}

/**
 * What creating or joining a room answers.
 */
export interface JoinResponse {
  room: Room;
  player: { id: string; token: string };
}
