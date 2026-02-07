/**
 * Central export for all shared types.
 * Import from here instead of individual files for convenience.
 */

// Player types
export type { Player } from './player';

// Room types
export type { Room, RoomStatus, RoomSettings } from './room';

// Game types
export type { Game, GameStatus } from './game';

// Round types
export type { Round, RoundStatus } from './round';

// Prompt and image generation types
export type {
  PromptSubmission,
  PromptSubmissionStatus,
  GeneratedImage,
  GeneratedImageStatus,
  ImageProvider,
  ImageMetadata,
} from './prompt';

// Image selection types
export type { ImageSelection } from './image';

// Guess types
export type { Guess } from './guess';

// Leaderboard types
export type { Leaderboard, PlayerScore } from './leaderboard';

// Event types
export * from './events';
