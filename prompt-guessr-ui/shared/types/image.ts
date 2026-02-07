/**
 * Represents a player's selection of their favorite image.
 * After generating 4 images from their prompt, each player picks one to show to others.
 */
export interface ImageSelection {
  /** ID of the player making the selection */
  playerId: string;
  
  /** ID of the image they selected from their 4 options */
  imageId: string;
  
  /** Timestamp when the selection was made */
  selectedAt: number;
}
