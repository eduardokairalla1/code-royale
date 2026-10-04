/**
 * Rooms to and from the json kept in Redis.
 */

// --- IMPORTS ---
import { CHALLENGE_DIFFICULTIES } from '../challenge/challenge.types.js';
import type { Challenge } from '../challenge/challenge.types.js';
import type { ChallengeDifficulty } from '../challenge/challenge.types.js';
import type { Draft } from '../game/game.types.js';
import type { PlayerResult } from '../game/game.types.js';
import type { Player } from './room.types.js';
import type { Room } from './room.types.js';
import type { RoomStatus } from './room.types.js';

// --- CODE ---
/**
 * Finds a challenge by id: rounds keep the id, not the whole challenge.
 */
export type ChallengeLookup = (id: string) => Challenge | null;

/**
 * A round as stored: maps become entry lists, the challenge its id.
 */
interface StoredRound {
  challengeId: string;
  startedAt: number;
  endsAt: number;
  results: [string, PlayerResult][];
  submissions: [string, Draft][];
}

/**
 * A room as stored.
 */
interface StoredRoom {
  code: string;
  hostId: string;
  status: RoomStatus;
  // in join order, which picks the next host
  players: Player[];
  round: StoredRound | null;
  playedChallengeIds: string[];
  // missing on rooms stored before the filter existed
  difficulties?: ChallengeDifficulty[];
  createdAt: number;
  version: number;
}

/**
 * Turn a room into json.
 *
 * @param {Room} room The room.
 *
 * @returns {string} The json to store.
 */
export function serializeRoom(room: Room): string {

  const round = room.round;

  const stored: StoredRoom = {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: [...room.players.values()],
    round: round && {
      challengeId: round.challenge.id,
      startedAt: round.startedAt,
      endsAt: round.endsAt,
      results: [...round.results.entries()],
      submissions: [...round.submissions.entries()],
    },
    playedChallengeIds: room.playedChallengeIds,
    difficulties: room.difficulties,
    createdAt: room.createdAt,
    version: room.version,
  };

  return JSON.stringify(stored);
}

/**
 * Turn stored json back into a room.
 *
 * @param {string} json The stored json.
 * @param {ChallengeLookup} findChallenge Finds the round's challenge.
 *
 * @returns {Room} The room.
 *
 * @throws {Error} When the round's challenge no longer exists.
 */
export function parseRoom(json: string, findChallenge: ChallengeLookup): Room {

  const stored = JSON.parse(json) as StoredRoom;
  const round = stored.round;

  let challenge: Challenge | null = null;

  // a challenge removed mid round leaves the round unplayable
  if (round) {
    challenge = findChallenge(round.challengeId);

    if (!challenge) {
      throw new Error(`Unknown challenge "${round.challengeId}"`);
    }
  }

  return {
    code: stored.code,
    hostId: stored.hostId,
    status: stored.status,
    players: new Map(stored.players.map((player) => [player.id, player])),
    round: round && challenge && {
      challenge,
      startedAt: round.startedAt,
      endsAt: round.endsAt,
      results: new Map(round.results),
      submissions: new Map(round.submissions),
    },
    playedChallengeIds: stored.playedChallengeIds,
    difficulties: stored.difficulties ?? [...CHALLENGE_DIFFICULTIES],
    createdAt: stored.createdAt,
    version: stored.version,
  };
}
