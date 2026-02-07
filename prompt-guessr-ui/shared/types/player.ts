/**
 * Represents a player in the game.
 * Used by both client and server to maintain consistent player state.
 */
export interface Player {
  /** Unique identifier for the player (UUID) */
  id: string;
  
  /** Socket.IO session ID - changes on reconnect */
  sessionId: string;
  
  /** Display name shown to other players */
  displayName: string;
  
  /** Avatar identifier or URL (optional) */
  avatar?: string;
  
  /** Whether this player is the room host */
  isHost: boolean;
  
  /** Whether the player is ready to start the game */
  isReady: boolean;
  
  /** Current connection status */
  isConnected: boolean;
  
  /** Timestamp when player joined the room */
  joinedAt: number;
  
  /** Timestamp of last activity (for disconnect detection) */
  lastSeenAt: number;
}
