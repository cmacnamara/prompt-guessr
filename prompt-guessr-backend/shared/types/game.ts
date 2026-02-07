import { Round } from './round';
import { Leaderboard } from './leaderboard';

/**
 * Game status represents the current phase of gameplay.
 * The game transitions through these states in order.
 */
export type GameStatus =
  | 'waiting'         // Initial state, waiting to start first round
  | 'prompt_submit'   // Players submitting their image prompts
  | 'image_generate'  // Server generating images (async, no player input)
  | 'image_select'    // Players selecting their favorite from 4 generated images
  | 'reveal_guess'    // Showing images sequentially, players guessing prompts
  | 'scoring'         // Server calculating scores (brief, automated)
  | 'reveal_results'  // Showing scored guesses and prompts for each image
  | 'round_end'       // Displaying round results and updated leaderboard
  | 'game_end';       // Final leaderboard, game complete

/**
 * Represents an active game session with rounds and scoring.
 * Created when the host starts the game from the lobby.
 */
export interface Game {
  /** Unique identifier for the game (UUID) */
  id: string;
  
  /** Room ID this game belongs to */
  roomId: string;
  
  /** Current game status/phase */
  status: GameStatus;
  
  /** Current round number (1-indexed) */
  currentRound: number;
  
  /** Array of all rounds (past and current) */
  rounds: Round[];
  
  /** Current leaderboard with all player scores */
  leaderboard: Leaderboard;
  
  /** Timestamp when game was created */
  createdAt: number;
  
  /** Timestamp when game started (first round began) */
  startedAt?: number;
  
  /** Timestamp when game finished */
  finishedAt?: number;
}
