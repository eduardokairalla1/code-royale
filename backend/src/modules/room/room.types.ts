/**
 * Room and player types.
 */

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
}

/**
 * A room, kept for as long as it has players.
 */
export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  players: Map<string, Player>;
  createdAt: number;
}
