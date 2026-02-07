/**
 * Detailed scoring information for a single player.
 */
export interface PlayerScore {
  /** Player's unique identifier */
  playerId: string;
  
  /** Player's display name */
  displayName: string;
  
  /** Total score across all rounds */
  totalScore: number;
  
  /** Array of scores for each round (index 0 = round 1) */
  roundScores: number[];
  
  /** Number of times this player had the winning guess */
  guessWins: number;
  
  /** Number of times their image was correctly guessed (future feature) */
  promptPicks: number;
}

/**
 * Leaderboard tracking all player scores.
 * Updated after each round's scoring phase.
 */
export interface Leaderboard {
  /** Map of player IDs to their detailed scores */
  scores: Map<string, PlayerScore>;
  
  /** Ordered array of player IDs, sorted by totalScore (highest first) */
  rankings: string[];
}
