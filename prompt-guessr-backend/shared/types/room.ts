import { Player } from './player';
import { Game } from './game';

/**
 * Room status indicates the current state of the game room.
 */
export type RoomStatus = 'lobby' | 'playing' | 'finished';

/**
 * Configuration settings for a game room.
 * These can be customized by the host before starting.
 */
export interface RoomSettings {
  /** Number of rounds to play (default: 3) */
  roundCount: number;
  
  /** Time limit for prompt submission in seconds (default: 90) */
  promptTimeLimit: number;
  
  /** Time limit for image selection in seconds (default: 45) */
  selectionTimeLimit: number;
  
  /** Time limit for guessing in seconds (default: 60) */
  guessingTimeLimit: number;
  
  /** Time to display results in seconds (default: 15) */
  resultsTimeLimit: number;
  
  /** Number of images to generate per prompt (default: 4) */
  imageCount: number;
}

/**
 * Represents a game room (lobby) where players gather before starting.
 */
export interface Room {
  /** Unique identifier for the room (UUID) */
  id: string;
  
  /** Short shareable code for easy joining (e.g., "ABCD") */
  code: string;
  
  /** Timestamp when room was created */
  createdAt: number;
  
  /** Player ID of the room creator */
  createdBy: string;
  
  /** Current room status */
  status: RoomStatus;
  
  /** Player ID of the current host */
  hostId: string;
  
  /** Map of player IDs to Player objects */
  players: Map<string, Player>;
  
  /** Maximum number of players allowed (default: 8) */
  maxPlayers: number;
  
  /** Game configuration settings */
  settings: RoomSettings;
  
  /** Active game session (only present when status is 'playing') */
  game?: Game;
}
