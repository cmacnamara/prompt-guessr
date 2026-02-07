/**
 * Represents a player's guess for what prompt was used to generate an image.
 * Players cannot guess on their own images.
 */
export interface Guess {
  /** Unique identifier for this guess (UUID) */
  id: string;
  
  /** ID of the image being guessed about */
  imageId: string;
  
  /** ID of the player making the guess */
  playerId: string;
  
  /** The player's guessed prompt text */
  guessText: string;
  
  /** Timestamp when the guess was submitted */
  submittedAt: number;
  
  /** 
   * Calculated similarity score (0-100).
   * Undefined until scoring phase runs.
   */
  score?: number;
}
