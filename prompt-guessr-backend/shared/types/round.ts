import { PromptSubmission } from './prompt';
import { ImageSelection } from './image';
import { Guess } from './guess';

/**
 * Round status tracks the current phase of the round.
 */
export type RoundStatus = 
  | 'prompt_submit'
  | 'image_generate' 
  | 'image_select'
  | 'reveal_guess'
  | 'scoring'
  | 'reveal_results'
  | 'completed';

/**
 * Represents a single round of the game.
 * Each round includes: prompt submission → image generation → selection → guessing → scoring.
 */
export interface Round {
  /** Unique identifier for the round (UUID) */
  id: string;
  
  /** Round number (1-indexed) */
  roundNumber: number;
  
  /** Map of player IDs to their prompt submissions */
  prompts: Map<string, PromptSubmission>;
  
  /** Map of player IDs to their image selections */
  selections: Map<string, ImageSelection>;
  
  /** 
   * Nested map of guesses: imageId → (guesserId → Guess)
   * Example: guesses.get('image123')?.get('player456') returns that player's guess
   */
  guesses: Map<string, Map<string, Guess>>;
  
  /** Index of the image currently being revealed during guessing phase (0-based) */
  currentRevealIndex: number;
  
  /** Index of the results currently being shown during reveal_results phase (0-based) */
  currentResultIndex: number;
  
  /** Map of imageId to bonus points awarded (50 for tricky prompts) */
  bonusPoints: Map<string, number>;
  
  /** Map of player IDs to their score for this round only */
  scores: Map<string, number>;
  
  /** Current status of the round */
  status: RoundStatus;
  
  /** Timestamp when round started */
  startedAt: number;
  
  /** Timestamp when round finished */
  finishedAt?: number;
}
