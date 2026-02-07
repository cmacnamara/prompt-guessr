import { Room, Game, Round, Leaderboard, Guess } from '../../shared/types';
import { getRedisClient } from './redis-client';
import { logger } from '../utils/logger';

/**
 * TTL for room data in Redis (24 hours in seconds)
 */
const ROOM_TTL = 24 * 60 * 60;

/**
 * Helper to serialize a Room for Redis storage.
 * Converts Map objects to plain objects that JSON.stringify can handle.
 */
function serializeRoom(room: Room): string {
  const serializable = {
    ...room,
    // Convert Map to object
    players: Object.fromEntries(room.players),
    // Serialize game if present
    game: room.game ? serializeGame(room.game) : undefined,
  };
  return JSON.stringify(serializable);
}

/**
 * Helper to serialize a Game object.
 */
function serializeGame(game: Game): any {
  return {
    ...game,
    leaderboard: {
      scores: Object.fromEntries(game.leaderboard.scores),
      rankings: game.leaderboard.rankings,
    },
    rounds: game.rounds.map(serializeRound),
  };
}

/**
 * Helper to serialize a Round object.
 */
function serializeRound(round: Round): any {
  return {
    ...round,
    prompts: Object.fromEntries(round.prompts),
    selections: Object.fromEntries(round.selections),
    guesses: Array.from(round.guesses.entries()).map(([imageId, guessMap]) => [
      imageId,
      Object.fromEntries(guessMap)
    ]),
    bonusPoints: Object.fromEntries(round.bonusPoints),
    scores: Object.fromEntries(round.scores),
  };
}


/**
 * Helper to deserialize a Room from Redis.
 * Converts plain objects back to Map objects.
 */
function deserializeRoom(data: string): Room {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    // Convert object back to Map
    players: new Map(Object.entries(parsed.players)),
    // Deserialize game if present
    game: parsed.game ? deserializeGame(parsed.game) : undefined,
  };
}

/**
 * Helper to deserialize a Game object.
 * Converts all nested plain objects back to Maps.
 */
function deserializeGame(gameData: any): Game {
  if (!gameData) return gameData;

  return {
    ...gameData,
    leaderboard: deserializeLeaderboard(gameData.leaderboard),
    rounds: gameData.rounds?.map(deserializeRound) || [],
  };
}

/**
 * Helper to deserialize a Leaderboard object.
 */
function deserializeLeaderboard(leaderboardData: any): Leaderboard {
  if (!leaderboardData) return leaderboardData;

  return {
    scores: new Map(Object.entries(leaderboardData.scores || {})),
    rankings: leaderboardData.rankings || [],
  };
}

/**
 * Helper to deserialize a Round object.
 */
function deserializeRound(roundData: any): Round {
  if (!roundData) return roundData;

  return {
    ...roundData,
    prompts: new Map(Object.entries(roundData.prompts || {})),
    selections: new Map(Object.entries(roundData.selections || {})),
    guesses: deserializeGuesses(roundData.guesses || []),
    bonusPoints: new Map(Object.entries(roundData.bonusPoints || {})),
    scores: new Map(Object.entries(roundData.scores || {})),
  };
}

/**
 * Helper to deserialize nested guesses Maps.
 */
function deserializeGuesses(guessesData: any): Map<string, Map<string, Guess>> {
  if (!guessesData) return new Map();
  
  // If it's already an array of entries (from serialization)
  if (Array.isArray(guessesData)) {
    return new Map(
      guessesData.map(([imageId, guessMap]: [string, any]) => [
        imageId,
        new Map(Object.entries(guessMap || {}))
      ])
    );
  }
  
  // If it's a plain object
  return new Map(
    Object.entries(guessesData).map(([imageId, guessMap]: [string, any]) => [
      imageId,
      new Map(Object.entries(guessMap || {}))
    ])
  );
}


/**
 * Create and save a new room to Redis.
 */
export async function createRoom(room: Room): Promise<void> {
  const redis = getRedisClient();
  const roomKey = `room:${room.id}`;
  const codeKey = `room:code:${room.code}`;
  
  try {
    // Save room data
    await redis.set(roomKey, serializeRoom(room), {
      EX: ROOM_TTL,
    });
    
    // Create code index for quick lookups
    await redis.set(codeKey, room.id, {
      EX: ROOM_TTL,
    });
    
    // Add to active rooms set
    await redis.sAdd('active_rooms', room.id);
    
    logger.info(`Room created: ${room.id} (code: ${room.code})`);
  } catch (error) {
    logger.error('Failed to create room:', error);
    throw error;
  }
}

/**
 * Get a room by its ID.
 */
export async function getRoomById(roomId: string): Promise<Room | null> {
  const redis = getRedisClient();
  const roomKey = `room:${roomId}`;
  
  try {
    const data = await redis.get(roomKey);
    if (!data) {
      return null;
    }
    return deserializeRoom(data);
  } catch (error) {
    logger.error(`Failed to get room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Get a room by its code.
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  const redis = getRedisClient();
  const codeKey = `room:code:${code}`;
  
  try {
    // First, get the room ID from the code index
    const roomId = await redis.get(codeKey);
    if (!roomId) {
      return null;
    }
    
    // Then fetch the room data
    return getRoomById(roomId);
  } catch (error) {
    logger.error(`Failed to get room by code ${code}:`, error);
    throw error;
  }
}

/**
 * Update an existing room.
 */
export async function updateRoom(room: Room): Promise<void> {
  const redis = getRedisClient();
  const roomKey = `room:${room.id}`;
  
  try {
    // Check if room exists
    const exists = await redis.exists(roomKey);
    if (!exists) {
      throw new Error(`Room ${room.id} does not exist`);
    }
    
    // Update room data (preserve TTL)
    await redis.set(roomKey, serializeRoom(room), {
      KEEPTTL: true,
    });
    
    logger.debug(`Room updated: ${room.id}`);
  } catch (error) {
    logger.error(`Failed to update room ${room.id}:`, error);
    throw error;
  }
}

/**
 * Delete a room from Redis.
 */
export async function deleteRoom(roomId: string, code: string): Promise<void> {
  const redis = getRedisClient();
  const roomKey = `room:${roomId}`;
  const codeKey = `room:code:${code}`;
  
  try {
    await redis.del(roomKey);
    await redis.del(codeKey);
    await redis.sRem('active_rooms', roomId);
    
    logger.info(`Room deleted: ${roomId}`);
  } catch (error) {
    logger.error(`Failed to delete room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Check if a room code is already in use.
 */
export async function isRoomCodeTaken(code: string): Promise<boolean> {
  const redis = getRedisClient();
  const codeKey = `room:code:${code}`;
  
  try {
    const exists = await redis.exists(codeKey);
    return exists === 1;
  } catch (error) {
    logger.error(`Failed to check room code ${code}:`, error);
    throw error;
  }
}
