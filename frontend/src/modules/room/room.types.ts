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
 * A room, as broadcast on every change.
 */
export interface Room {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: Player[];
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
