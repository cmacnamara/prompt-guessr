import { Player, Room, Game } from './index';

/**
 * ============================================================================
 * CLIENT → SERVER EVENTS
 * ============================================================================
 */

/**
 * Player joins a room via socket.
 */
export interface JoinRoomEvent {
  roomId: string;
  playerId: string;
}

/**
 * Player updates their ready status.
 */
export interface PlayerReadyEvent {
  roomId: string;
  playerId: string;
  isReady: boolean;
}

/**
 * Host starts the game.
 */
export interface StartGameEvent {
  roomId: string;
  playerId: string;
}

/**
 * Player submits a prompt for the current round.
 */
export interface SubmitPromptEvent {
  roomId: string;
  playerId: string;
  prompt: string;
}

/**
 * Player resubmits a prompt after rejection.
 */
export interface ResubmitPromptEvent {
  roomId: string;
  playerId: string;
  prompt: string;
}

/**
 * Player selects their favorite image from generated options.
 */
export interface SelectImageEvent {
  roomId: string;
  playerId: string;
  imageId: string;
}

/**
 * Player submits a guess for which prompt created an image.
 */
export interface SubmitGuessEvent {
  roomId: string;
  playerId: string;
  imageId: string;
  guessText: string;
}
/**
 * Navigate results during reveal phase (next/previous)
 */
export interface NavigateResultEvent {
  roomId: string;
  playerId: string;
  direction: 'next' | 'previous';
}

/**
 * Complete the reveal phase and move to next round or game end.
 */
export interface CompleteRevealEvent {
  roomId: string;
  playerId: string;
}

/**
 * Host starts the next round.
 */
export interface NextRoundEvent {
  roomId: string;
  playerId: string;
}

/**
 * ============================================================================
 * SERVER → CLIENT EVENTS
 * ============================================================================
 */

/**
 * Room state update sent to all players in the room.
 */
export interface RoomUpdateEvent {
  room: Room;
}

/**
 * Player joined the room.
 */
export interface PlayerJoinedEvent {
  player: Player;
  room: Room;
}

/**
 * Player left the room.
 */
export interface PlayerLeftEvent {
  playerId: string;
  playerName: string;
  reason: 'disconnect' | 'kicked' | 'left';
  newHostId?: string;
}

/**
 * Player ready status changed.
 */
export interface PlayerReadyChangedEvent {
  playerId: string;
  playerName: string;
  isReady: boolean;
}

/**
 * Game has started.
 */
export interface GameStartedEvent {
  roomId: string;
  game: Game;
}

/**
 * Player submitted a prompt.
 */
export interface PromptSubmittedEvent {
  playerId: string;
  playerName: string;
}

/**
 * Player's prompt was rejected by content safety system.
 */
export interface PromptRejectedEvent {
  playerId: string;
  reason: string;
}

/**
 * Game phase has transitioned (e.g., prompt_submit -> image_generate).
 */
export interface PhaseTransitionEvent {
  roomId: string;
  game: Game;
  newPhase: string;
}

/**
 * Image generation progress update.
 */
export interface ImageProgressEvent {
  roomId: string;
  game: Game;
}

/**
 * Error event sent to a specific client.
 */
export interface ErrorEvent {
  code: string;
  message: string;
  context?: any;
}

/**
 * ============================================================================
 * EVENT NAMES (Constants)
 * ============================================================================
 */

export const SocketEvents = {
  // Client → Server
  JOIN_ROOM: 'room:join',
  PLAYER_READY: 'player:ready',
  START_GAME: 'game:start',
  SUBMIT_PROMPT: 'game:submit_prompt',
  RESUBMIT_PROMPT: 'game:resubmit_prompt',
  SELECT_IMAGE: 'game:select_image',
  SUBMIT_GUESS: 'game:submit_guess',
  NAVIGATE_RESULT: 'game:navigate_result',
  COMPLETE_REVEAL: 'game:complete_reveal',
  NEXT_ROUND: 'game:next_round',
  
  // Server → Client
  ROOM_UPDATE: 'room:update',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_READY_CHANGED: 'player:ready_changed',
  GAME_STARTED: 'game:started',
  PROMPT_SUBMITTED: 'game:prompt_submitted',
  PROMPT_REJECTED: 'game:prompt_rejected',
  PHASE_TRANSITION: 'game:phase_transition',
  IMAGE_PROGRESS: 'game:image_progress',
  ERROR: 'error',
} as const;
