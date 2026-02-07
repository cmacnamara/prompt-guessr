import { v4 as uuidv4 } from 'uuid';
import { Room, Player, RoomSettings, Game, Round } from '../../shared/types';
import {
  createRoom as saveRoom,
  getRoomById,
  getRoomByCode,
  updateRoom,
  deleteRoom,
  isRoomCodeTaken,
} from '../storage/room-repository';
import { generateRoomCode } from '../utils/code-generator';
import { logger } from '../utils/logger';
import { generateImages as generateImagesFromProvider, ContentPolicyViolationError } from './image-service';
import { calculateSimilarityScore, calculatePoints } from './scoring-service';

/**
 * Default room settings.
 */
const DEFAULT_SETTINGS: RoomSettings = {
  roundCount: 3,
  promptTimeLimit: 90,
  selectionTimeLimit: 45,
  guessingTimeLimit: 60,
  resultsTimeLimit: 15,
  imageCount: 4,
};

/**
 * Helper: Validate room exists.
 * @throws Error if room is null/undefined
 */
function validateRoom(room: Room | null): asserts room is Room {
  if (!room) {
    throw new Error('Room not found');
  }
}

/**
 * Helper: Validate game exists on room.
 * @throws Error if no active game
 */
function validateGame(room: Room): asserts room is Room & { game: Game } {
  if (!room.game) {
    throw new Error('No active game');
  }
}

/**
 * Helper: Get and validate current round.
 * @throws Error if no current round exists
 */
function getCurrentRound(game: Game): Round {
  const currentRound = game.rounds[game.currentRound - 1];
  if (!currentRound) {
    throw new Error('No active round');
  }
  return currentRound;
}

/**
 * Helper: Validate player is the host.
 * @throws Error if player not found or not host
 */
function validateHost(room: Room, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    throw new Error('Only the host can perform this action');
  }
}

/**
 * Save room state to Redis.
 * This is a simple wrapper around updateRoom for clarity.
 */
export async function saveRoomState(room: Room): Promise<void> {
  await updateRoom(room);
}

/**
 * Create a new room with a host player.
 * 
 * @param playerName - Display name for the host player
 * @param settings - Optional custom room settings
 * @returns Object containing the created room and host player ID
 */
export async function createRoom(
  playerName: string,
  sessionId: string,
  settings?: Partial<RoomSettings>
): Promise<{ room: Room; playerId: string }> {
  // Generate unique room code
  let code = generateRoomCode();
  let attempts = 0;
  while (await isRoomCodeTaken(code)) {
    code = generateRoomCode();
    attempts++;
    if (attempts > 10) {
      throw new Error('Failed to generate unique room code');
    }
  }

  // Create host player
  const playerId = uuidv4();
  const now = Date.now();
  
  const hostPlayer: Player = {
    id: playerId,
    sessionId,
    displayName: playerName,
    isHost: true,
    isReady: false,
    isConnected: true,
    joinedAt: now,
    lastSeenAt: now,
  };

  // Create room
  const room: Room = {
    id: uuidv4(),
    code,
    createdAt: now,
    createdBy: playerId,
    status: 'lobby',
    hostId: playerId,
    players: new Map([[playerId, hostPlayer]]),
    maxPlayers: 8,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };

  // Save to Redis
  await saveRoom(room);

  logger.info(`Room created: ${room.code} by ${playerName}`);

  return { room, playerId };
}

/**
 * Add a player to an existing room.
 * 
 * @param roomCode - The room code to join
 * @param playerName - Display name for the joining player
 * @param sessionId - Socket session ID
 * @returns Object containing the room and new player ID
 */
export async function joinRoom(
  roomCode: string,
  playerName: string,
  sessionId: string
): Promise<{ room: Room; playerId: string }> {
  // Get room
  const room = await getRoomByCode(roomCode.toUpperCase());
  
  if (!room) {
    throw new Error('Room not found');
  }

  // Validate room state
  if (room.status !== 'lobby') {
    throw new Error('Game already in progress');
  }

  if (room.players.size >= room.maxPlayers) {
    throw new Error('Room is full');
  }

  // Create new player
  const playerId = uuidv4();
  const now = Date.now();
  
  const player: Player = {
    id: playerId,
    sessionId,
    displayName: playerName,
    isHost: false,
    isReady: false,
    isConnected: true,
    joinedAt: now,
    lastSeenAt: now,
  };

  // Add player to room
  room.players.set(playerId, player);

  // Save updated room
  await updateRoom(room);

  logger.info(`Player ${playerName} joined room ${room.code}`);

  return { room, playerId };
}

/**
 * Update a player's ready status.
 */
export async function setPlayerReady(
  roomId: string,
  playerId: string,
  isReady: boolean
): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error('Player not found in room');
  }

  player.isReady = isReady;
  room.players.set(playerId, player);

  await updateRoom(room);

  logger.debug(`Player ${player.displayName} ready status: ${isReady}`);

  return room;
}

/**
 * Remove a player from a room.
 * Handles host migration if the leaving player is the host.
 */
export async function removePlayer(
  roomId: string,
  playerId: string
): Promise<{ room: Room | null; newHostId?: string }> {
  const room = await getRoomById(roomId);
  validateRoom(room);

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error('Player not found in room');
  }

  // Remove player
  room.players.delete(playerId);

  // If room is now empty, delete it
  if (room.players.size === 0) {
    await deleteRoom(room.id, room.code);
    logger.info(`Room ${room.code} deleted (empty)`);
    return { room: null };
  }

  // Handle host migration
  let newHostId: string | undefined;
  if (player.isHost) {
    // Find the player who joined earliest (longest in room)
    const sortedPlayers: Player[] = Array.from(room.players.values()).sort(
      (a: Player, b: Player) => a.joinedAt - b.joinedAt
    );
    const newHost = sortedPlayers[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    room.players.set(newHost.id, newHost);
    newHostId = newHost.id;
    
    logger.info(`Host migrated to ${newHost.displayName} in room ${room.code}`);
  }

  await updateRoom(room);

  logger.info(`Player ${player.displayName} removed from room ${room.code}`);

  return { room, newHostId };
}

/**
 * Update player connection status.
 */
export async function updatePlayerConnection(
  roomId: string,
  playerId: string,
  isConnected: boolean
): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error('Player not found in room');
  }

  player.isConnected = isConnected;
  player.lastSeenAt = Date.now();
  room.players.set(playerId, player);

  await updateRoom(room);

  return room;
}

/**
 * Start the game for a room.
 * Transitions room status to 'playing' and creates initial game state.
 * 
 * @param roomId - The room ID
 * @returns Updated room with game initialized
 */
export async function startGame(roomId: string): Promise<{ room: Room; game: Game }> {
  const room = await getRoomById(roomId);
  validateRoom(room);

  if (room.status !== 'lobby') {
    throw new Error('Game already started');
  }

  const now = Date.now();

  // Create initial leaderboard with all players at 0 points
  const playerScores = new Map(
    Array.from(room.players.values()).map(player => [
      player.id,
      {
        playerId: player.id,
        displayName: player.displayName,
        totalScore: 0,
        roundScores: [],
        guessWins: 0,
        promptPicks: 0,
      }
    ])
  );

  const leaderboard = {
    scores: playerScores,
    rankings: Array.from(room.players.keys()),
  };

  // Create first round
  const firstRound: Round = {
    id: uuidv4(),
    roundNumber: 1,
    prompts: new Map(),
    selections: new Map(),
    guesses: new Map(),
    currentRevealIndex: 0,
    currentResultIndex: 0,
    bonusPoints: new Map(),
    scores: new Map(),
    status: 'prompt_submit',
    startedAt: now,
  };

  // Create game
  const game: Game = {
    id: uuidv4(),
    roomId: room.id,
    status: 'prompt_submit',
    currentRound: 1,
    rounds: [firstRound],
    leaderboard,
    createdAt: now,
    startedAt: now,
  };

  // Update room
  room.status = 'playing';
  room.game = game;

  await updateRoom(room);

  logger.info(`Game started in room ${room.code}`);

  return { room, game };
}

/**
 * Submit a prompt for the current round.
 */
export async function submitPrompt(
  roomId: string,
  playerId: string,
  prompt: string
): Promise<{ room: Room; allSubmitted: boolean }> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'prompt_submit') {
    throw new Error('Not in prompt submission phase');
  }

  // Store the prompt
  currentRound.prompts.set(playerId, {
    playerId,
    prompt,
    submittedAt: Date.now(),
    images: [],
    status: 'pending',
  });

  // Check if all players have submitted
  const allSubmitted = currentRound.prompts.size === room.players.size;

  if (allSubmitted) {
    // Transition to image generation phase
    currentRound.status = 'image_generate';
    room.game.status = 'image_generate';
    logger.info(`All players submitted prompts in room ${room.code}, transitioning to image_generate`);
  }

  await updateRoom(room);

  logger.info(`Player ${playerId} submitted prompt in room ${room.code}`);

  return { room, allSubmitted };
}

/**
 * Resubmit a prompt after it was rejected for content policy violation.
 * Generates new images for just this player's prompt.
 */
export async function resubmitPrompt(
  roomId: string,
  playerId: string,
  newPrompt: string
): Promise<{ room: Room; shouldTransition: boolean }> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'image_generate') {
    throw new Error('Can only resubmit prompts during image generation phase');
  }

  const existingSubmission = currentRound.prompts.get(playerId);
  if (!existingSubmission) {
    throw new Error('No prompt submission found for this player');
  }

  if (existingSubmission.status !== 'rejected') {
    throw new Error('Can only resubmit rejected prompts');
  }

  logger.info(`Player ${playerId} resubmitting prompt in room ${room.code}`);

  // Update the prompt with new text and reset status
  existingSubmission.prompt = newPrompt;
  existingSubmission.submittedAt = Date.now();
  existingSubmission.images = [];
  existingSubmission.status = 'generating';

  await updateRoom(room);

  // Generate images for this prompt
  try {
    const images = await generateImagesFromProvider(
      newPrompt,
      room.settings.imageCount,
      playerId
    );

    // Set the promptId for each image
    images.forEach(img => {
      img.promptId = playerId;
    });

    // Update the submission
    existingSubmission.images = images;
    existingSubmission.status = 'ready';

    logger.info(`Successfully generated ${images.length} images for resubmitted prompt from player ${playerId}`);
  } catch (error) {
    if (error instanceof ContentPolicyViolationError) {
      logger.warn(`Resubmitted prompt also rejected for player ${playerId}: ${error.message}`);
      existingSubmission.status = 'rejected';
      await updateRoom(room);
      throw error; // Re-throw so socket handler knows to emit PROMPT_REJECTED again
    } else {
      logger.error(`Failed to generate images for resubmitted prompt from player ${playerId}:`, error);
      existingSubmission.status = 'failed';
      await updateRoom(room);
      throw error;
    }
  }

  // Check if all prompts are now ready
  const allReady = Array.from(currentRound.prompts.values()).every(
    p => p.status === 'ready'
  );

  if (allReady) {
    // Transition to image selection phase
    currentRound.status = 'image_select';
    room.game.status = 'image_select';
    logger.info(`All prompts ready in room ${room.code}, transitioning to image_select`);
  }

  await updateRoom(room);

  return { room, shouldTransition: allReady };
}

/**
 * Generate images for all submitted prompts in the current round.
 * Should be called when game enters 'image_generate' phase.
 * 
 * @param roomId - The room ID
 * @param onProgress - Optional callback called after each prompt's images complete
 * @returns Updated room with generated images and list of rejected player IDs
 */
export async function generateImagesForRound(
  roomId: string,
  onProgress?: (room: Room) => void | Promise<void>
): Promise<{ room: Room; rejectedPlayerIds: string[] }> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'image_generate') {
    throw new Error('Not in image generation phase');
  }

  logger.info(`Generating images for ${currentRound.prompts.size} prompts in room ${room.code}`);

  // Track which players had content violations
  const rejectedPlayerIds: string[] = [];

  // Generate images for each prompt in parallel
  const imageGenerationPromises = Array.from(currentRound.prompts.entries()).map(
    async ([playerId, promptSubmission]) => {
      try {
        // Update status to generating
        promptSubmission.status = 'generating';
        
        logger.info(`Starting image generation for player ${playerId}`);
        
        // Generate images using the image service
        const images = await generateImagesFromProvider(
          promptSubmission.prompt,
          room.settings.imageCount,
          playerId
        );

        // Set the promptId for each image
        images.forEach(img => {
          img.promptId = playerId; // Using playerId as promptId for now
        });

        // Update the prompt submission with generated images
        promptSubmission.images = images;
        promptSubmission.status = 'ready';
        
        logger.info(`Generated ${images.length} images for player ${playerId} in room ${room.code}`);
        
        // Notify progress after this player's images complete
        if (onProgress) {
          await onProgress(room);
        }
      } catch (error) {
        if (error instanceof ContentPolicyViolationError) {
          logger.warn(`Content policy violation for player ${playerId}: ${error.message}`);
          promptSubmission.status = 'rejected';
          rejectedPlayerIds.push(playerId);
        } else {
          logger.error(`Failed to generate images for player ${playerId}:`, error);
          promptSubmission.status = 'failed';
        }
        
        // Still notify on failure
        if (onProgress) {
          await onProgress(room);
        }
      }
    }
  );

  // Wait for all image generations to complete
  await Promise.all(imageGenerationPromises);

  // Check if any prompts were rejected
  if (rejectedPlayerIds.length > 0) {
    logger.warn(`${rejectedPlayerIds.length} prompts rejected in room ${room.code} - staying in image_generate`);
    // Stay in image_generate phase - don't transition
    // The socket handler will emit PROMPT_REJECTED events for these players
    await updateRoom(room);
    return { room, rejectedPlayerIds };
  }

  // Check if all image generations succeeded
  const allReady = Array.from(currentRound.prompts.values()).every(
    p => p.status === 'ready'
  );

  if (allReady) {
    // Transition to image selection phase
    currentRound.status = 'image_select';
    room.game.status = 'image_select';
    logger.info(`All images generated in room ${room.code}, transitioning to image_select`);
  } else {
    // Some failed - handle gracefully (for now, still transition)
    const failedCount = Array.from(currentRound.prompts.values()).filter(
      p => p.status === 'failed'
    ).length;
    logger.warn(`${failedCount} image generations failed in room ${room.code}, transitioning anyway`);
    currentRound.status = 'image_select';
    room.game.status = 'image_select';
  }

  await updateRoom(room);
  return { room, rejectedPlayerIds: [] };
}

/**
 * Submit an image selection for the current round.
 */
export async function selectImage(
  roomId: string,
  playerId: string,
  imageId: string
): Promise<{ room: Room; allSelected: boolean }> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'image_select') {
    throw new Error('Not in image selection phase');
  }

  // Store the selection
  currentRound.selections.set(playerId, {
    playerId,
    imageId,
    selectedAt: Date.now(),
  });

  // Check if all players have selected
  const allSelected = currentRound.selections.size === room.players.size;

  if (allSelected) {
    // Transition to guessing phase
    currentRound.status = 'reveal_guess';
    room.game.status = 'reveal_guess';
    logger.info(`All players selected images in room ${room.code}, transitioning to reveal_guess`);
  }

  await updateRoom(room);

  logger.info(`Player ${playerId} selected image in room ${room.code}`);

  return { room, allSelected };
}

/**
 * Submit a guess for an image.
 */
export async function submitGuess(
  roomId: string,
  playerId: string,
  imageId: string,
  guessText: string
): Promise<{ room: Room; allGuessed: boolean }> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'reveal_guess') {
    throw new Error('Not in guessing phase');
  }

  // Get or create the guesses map for this image
  let imageGuesses = currentRound.guesses.get(imageId);
  if (!imageGuesses) {
    imageGuesses = new Map();
    currentRound.guesses.set(imageId, imageGuesses);
  }

  // Store the guess
  imageGuesses.set(playerId, {
    id: uuidv4(),
    imageId,
    playerId,
    guessText,
    submittedAt: Date.now(),
  });

  // Check if all players have guessed on this image
  // (excluding the player who created this image)
  const imageSubmitter = Array.from(currentRound.selections.values()).find(
    selection => selection.imageId === imageId
  )?.playerId;

  const expectedGuesses = imageSubmitter ? room.players.size - 1 : room.players.size;
  const allGuessed = imageGuesses.size >= expectedGuesses;

  // Get all selected images for this round
  const selectedImages = Array.from(currentRound.selections.values());
  const totalImages = selectedImages.length;

  // Advance to next image or transition to scoring
  if (allGuessed) {
    if (currentRound.currentRevealIndex < totalImages - 1) {
      // More images to reveal - advance to next
      currentRound.currentRevealIndex++;
      logger.info(`Advancing to image ${currentRound.currentRevealIndex + 1}/${totalImages} in room ${room.code}`);
    } else {
      // All images revealed - transition to scoring
      currentRound.status = 'scoring';
      room.game.status = 'scoring';
      logger.info(`All images revealed in room ${room.code}, transitioning to scoring`);
    }
  }

  await updateRoom(room);

  logger.info(`Player ${playerId} submitted guess for image ${imageId} in room ${room.code}`);

  return { room, allGuessed };
}

/**
 * Calculate scores for the current round.
 */
export async function scoreRound(roomId: string): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (currentRound.status !== 'scoring') {
    throw new Error('Not in scoring phase');
  }

  logger.info(`Calculating scores for round ${currentRound.roundNumber} in room ${room.code}`);

  // Initialize round scores
  currentRound.scores.clear();

  // Score each image's guesses
  for (const [imageId, imageGuesses] of currentRound.guesses.entries()) {
    // Find the original prompt for this image
    const selection = Array.from(currentRound.selections.values()).find(
      sel => sel.imageId === imageId
    );
    
    if (!selection) continue;

    const promptSubmission = currentRound.prompts.get(selection.playerId);
    if (!promptSubmission) continue;

    const originalPrompt = promptSubmission.prompt;
    const imageCreatorId = selection.playerId;

    // Calculate similarity scores for all guesses and store them
    const scoredGuesses = Array.from(imageGuesses.entries()).map(([playerId, guess]) => {
      const similarityScore = calculateSimilarityScore(originalPrompt, guess.guessText);
      // Store the score in the guess object
      guess.score = similarityScore;
      return {
        playerId,
        score: similarityScore,
      };
    });

    // Award points based on scores
    const pointsAwarded = calculatePoints(scoredGuesses, imageCreatorId);

    // Check if bonus points were awarded (image was tricky)
    const avgScore = scoredGuesses.reduce((sum, s) => sum + s.score, 0) / scoredGuesses.length;
    if (avgScore < 40) {
      currentRound.bonusPoints.set(imageId, 50);
    }

    // Update round scores
    for (const [playerId, points] of pointsAwarded.entries()) {
      const currentScore = currentRound.scores.get(playerId) || 0;
      currentRound.scores.set(playerId, currentScore + points);
    }
  }

  // Update leaderboard with round scores
  for (const [playerId, roundScore] of currentRound.scores.entries()) {
    let playerScore = room.game.leaderboard.scores.get(playerId);
    
    if (!playerScore) {
      const player = room.players.get(playerId);
      playerScore = {
        playerId,
        displayName: player?.displayName || 'Unknown',
        totalScore: 0,
        roundScores: [],
        guessWins: 0,
        promptPicks: 0,
      };
      room.game.leaderboard.scores.set(playerId, playerScore);
    }

    playerScore.totalScore += roundScore;
    playerScore.roundScores.push(roundScore);
  }

  // Update rankings
  room.game.leaderboard.rankings = Array.from(room.game.leaderboard.scores.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map(ps => ps.playerId);

  // Transition to reveal phase to show results
  currentRound.status = 'reveal_results';
  room.game.status = 'reveal_results';
  
  logger.info(`Scores calculated for round ${currentRound.roundNumber} in room ${room.code}, transitioning to reveal_results`);

  await updateRoom(room);

  return room;
}

/**
 * Complete the reveal phase and transition to next round or game end.
 */
export async function completeReveal(roomId: string): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  // Guard: only proceed if we're in reveal_results phase
  if (room.game.status !== 'reveal_results') {
    logger.warn(`Ignoring completeReveal - game is in ${room.game.status} phase, not reveal_results`);
    return room;
  }

  // Mark round as completed
  currentRound.status = 'completed';
  currentRound.finishedAt = Date.now();

  // Check if game is complete or start next round
  if (room.game.currentRound >= room.settings.roundCount) {
    // Game complete
    room.game.status = 'game_end';
    room.game.finishedAt = Date.now();
    logger.info(`Game complete in room ${room.code}`);
  } else {
    // More rounds to play
    room.game.status = 'round_end';
    logger.info(`Round ${currentRound.roundNumber} complete in room ${room.code}`);
  }

  await updateRoom(room);

  return room;
}

/**
 * Start the next round of the game.
 * Creates a new round and transitions to prompt_submit phase.
 */
export async function startNextRound(roomId: string, hostId: string): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  validateHost(room, hostId);

  // Validate we're in round_end status
  if (room.game.status !== 'round_end') {
    throw new Error('Cannot start next round - game is not in round_end status');
  }

  // Validate we haven't exceeded max rounds
  if (room.game.currentRound >= room.settings.roundCount) {
    throw new Error('No more rounds to play - game is complete');
  }

  // Increment round counter
  room.game.currentRound += 1;

  // Create new round
  const newRound: Round = {
    id: uuidv4(),
    roundNumber: room.game.currentRound,
    prompts: new Map(),
    selections: new Map(),
    guesses: new Map(),
    currentRevealIndex: 0,
    currentResultIndex: 0,
    bonusPoints: new Map(),
    scores: new Map(),
    status: 'prompt_submit',
    startedAt: Date.now(),
  };

  room.game.rounds.push(newRound);
  room.game.status = 'prompt_submit';

  await updateRoom(room);

  logger.info(`Started round ${room.game.currentRound} in room ${room.code}`);

  return room;
}

/**
 * Navigate between results during reveal phase.
 * Any player can advance or go back through the results.
 */
export async function navigateResult(
  roomId: string,
  direction: 'next' | 'previous'
): Promise<Room> {
  const room = await getRoomById(roomId);
  validateRoom(room);
  validateGame(room);
  const currentRound = getCurrentRound(room.game);

  if (room.game.status !== 'reveal_results') {
    throw new Error('Not in reveal results phase');
  }

  // Get total number of images to reveal
  const totalImages = currentRound.selections.size;

  if (direction === 'next') {
    if (currentRound.currentResultIndex < totalImages - 1) {
      currentRound.currentResultIndex += 1;
    }
  } else if (currentRound.currentResultIndex > 0) {
    currentRound.currentResultIndex -= 1;
  }

  await updateRoom(room);

  logger.info(
    `Result navigation ${direction} to index ${currentRound.currentResultIndex} in room ${room.code}`
  );

  return room;
}
