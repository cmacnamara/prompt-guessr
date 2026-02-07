import { Server, Socket } from 'socket.io';
import {
  SocketEvents,
  JoinRoomEvent,
  PlayerReadyEvent,
  RoomUpdateEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerReadyChangedEvent,
  SubmitPromptEvent,
  ResubmitPromptEvent,
  PromptSubmittedEvent,
  PromptRejectedEvent,
  PhaseTransitionEvent,
  ImageProgressEvent,
  SubmitGuessEvent,
  NavigateResultEvent,
  CompleteRevealEvent,
  NextRoundEvent,
} from '../../shared/types/events';
import { getRoomById } from '../storage/room-repository';
import * as roomService from '../services/room-service';
import { logger } from '../utils/logger';

/**
 * Handle player joining a room via socket.
 */
async function handleJoinRoom(
  io: Server,
  socket: Socket,
  data: JoinRoomEvent
): Promise<void> {
  try {
    const { roomId, playerId } = data;

    // Get the room
    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    // Verify player is in the room
    const player = room.players.get(playerId);
    if (!player) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYER_NOT_IN_ROOM',
        message: 'Player not found in room',
      });
      return;
    }

    // Update player's session ID to current socket
    await roomService.updatePlayerConnection(roomId, playerId, true);

    // Join the socket.io room
    await socket.join(roomId);

    logger.info(`Player ${player.displayName} joined room ${room.code} via socket`);

    // Send current room state to the joining player
    const updatedRoom = await getRoomById(roomId);
    if (updatedRoom) {
      socket.emit(SocketEvents.ROOM_UPDATE, {
        room: serializeRoom(updatedRoom),
      } as RoomUpdateEvent);

      // Notify other players
      socket.to(roomId).emit(SocketEvents.PLAYER_JOINED, {
        player,
        room: serializeRoom(updatedRoom),
      } as PlayerJoinedEvent);
    }
  } catch (error) {
    logger.error('Error in handleJoinRoom:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'JOIN_FAILED',
      message: 'Failed to join room',
    });
  }
}

/**
 * Handle player ready status change.
 */
async function handlePlayerReady(
  io: Server,
  socket: Socket,
  data: PlayerReadyEvent
): Promise<void> {
  try {
    const { roomId, playerId, isReady } = data;

    const room = await roomService.setPlayerReady(roomId, playerId, isReady);
    const player = room.players.get(playerId);

    if (!player) {
      return;
    }

    logger.info(`Player ${player.displayName} ready: ${isReady}`);

    // Broadcast to all players in the room
    io.to(roomId).emit(SocketEvents.PLAYER_READY_CHANGED, {
      playerId,
      playerName: player.displayName,
      isReady,
    } as PlayerReadyChangedEvent);

    // Send updated room state
    io.to(roomId).emit(SocketEvents.ROOM_UPDATE, {
      room: serializeRoom(room),
    } as RoomUpdateEvent);
  } catch (error) {
    logger.error('Error in handlePlayerReady:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'READY_FAILED',
      message: 'Failed to update ready status',
    });
  }
}

/**
 * Handle starting the game.
 */
async function handleStartGame(
  io: Server,
  socket: Socket,
  data: { roomId: string; playerId: string }
): Promise<void> {
  try {
    const { roomId, playerId } = data;

    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    // Verify player is the host
    const player = room.players.get(playerId);
    if (!player?.isHost) {
      socket.emit(SocketEvents.ERROR, {
        code: 'NOT_HOST',
        message: 'Only the host can start the game',
      });
      return;
    }

    // Verify minimum players
    if (room.players.size < 2) {
      socket.emit(SocketEvents.ERROR, {
        code: 'NOT_ENOUGH_PLAYERS',
        message: 'Need at least 2 players to start',
      });
      return;
    }

    // Verify all players are ready
    const allReady = Array.from(room.players.values()).every(p => p.isReady);

    if (!allReady) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYERS_NOT_READY',
        message: 'All players must be ready',
      });
      return;
    }

    logger.info(`Host ${player.displayName} starting game in room ${room.code}`);

    // Start the game (transitions to prompt_submit phase)
    const { game } = await roomService.startGame(roomId);

    // Broadcast game started event to all players
    io.to(roomId).emit(SocketEvents.GAME_STARTED, {
      roomId,
      game: serializeGame(game),
    });
  } catch (error) {
    logger.error('Error in handleStartGame:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'START_GAME_FAILED',
      message: 'Failed to start game',
    });
  }
}

/**
 * Handle player submitting a prompt.
 */
async function handleSubmitPrompt(
  io: Server,
  socket: Socket,
  data: SubmitPromptEvent
): Promise<void> {
  try {
    const { roomId, playerId, prompt } = data;

    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYER_NOT_IN_ROOM',
        message: 'Player not found in room',
      });
      return;
    }

    logger.info(`Player ${player.displayName} submitting prompt in room ${room.code}`);

    // Submit the prompt
    const { room: updatedRoom, allSubmitted } = await roomService.submitPrompt(roomId, playerId, prompt);

    // Broadcast to all players that this player submitted
    io.to(roomId).emit(SocketEvents.PROMPT_SUBMITTED, {
      playerId,
      playerName: player.displayName,
    } as PromptSubmittedEvent);

    // If all players submitted, broadcast phase transition and trigger image generation
    if (allSubmitted && updatedRoom.game) {
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: 'image_generate',
      } as PhaseTransitionEvent);

      // Trigger image generation in background
      logger.info(`Triggering image generation for room ${room.code}`);
      generateImagesInBackground(io, roomId);
    }
  } catch (error) {
    logger.error('Error in handleSubmitPrompt:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'SUBMIT_PROMPT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to submit prompt',
    });
  }
}

/**
 * Handle player resubmitting a rejected prompt.
 */
async function handleResubmitPrompt(
  io: Server,
  socket: Socket,
  data: ResubmitPromptEvent
): Promise<void> {
  try {
    const { roomId, playerId, prompt } = data;

    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYER_NOT_IN_ROOM',
        message: 'Player not found in room',
      });
      return;
    }

    logger.info(`Player ${player.displayName} resubmitting prompt in room ${room.code}`);

    try {
      // Resubmit the prompt and generate images
      const { room: updatedRoom, shouldTransition } = await roomService.resubmitPrompt(roomId, playerId, prompt);

      // Notify all players of progress update
      if (updatedRoom.game) {
        io.to(roomId).emit(SocketEvents.IMAGE_PROGRESS, {
          roomId,
          game: serializeGame(updatedRoom.game),
        } as ImageProgressEvent);
      }

      // If all prompts are now ready, transition to image_select
      if (shouldTransition && updatedRoom.game) {
        io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
          roomId,
          game: serializeGame(updatedRoom.game),
          newPhase: 'image_select',
        } as PhaseTransitionEvent);
        
        logger.info(`All prompts ready after resubmission in room ${room.code}, transitioned to image_select`);
      }
    } catch (resubmitError: any) {
      // Check if it's another content violation
      if (resubmitError.name === 'ContentPolicyViolationError') {
        socket.emit(SocketEvents.PROMPT_REJECTED, {
          playerId,
          reason: 'Your prompt was rejected again. Please try a different prompt.',
        } as PromptRejectedEvent);
        
        logger.warn(`Resubmitted prompt also rejected for player ${playerId} in room ${room.code}`);
      } else {
        throw resubmitError;
      }
    }
  } catch (error) {
    logger.error('Error in handleResubmitPrompt:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'RESUBMIT_PROMPT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to resubmit prompt',
    });
  }
}

/**
 * Generate images in background and notify when complete.
 * This runs async so the socket handler doesn't block.
 */
async function generateImagesInBackground(io: Server, roomId: string): Promise<void> {
  try {
    logger.info(`Starting image generation for room ${roomId}`);
    
    let progressCount = 0;
    
    // Generate all images with progress updates
    const result = await roomService.generateImagesForRound(roomId, async (room) => {
      progressCount++;
      
      // Save the current state before emitting
      await roomService.saveRoomState(room);
      
      // Emit progress update to all players
      if (room.game) {
        const currentRound = room.game.rounds[room.game.currentRound - 1];
        const ready = Array.from(currentRound.prompts.values()).filter(p => p.status === 'ready').length;
        const total = currentRound.prompts.size;
        
        logger.info(`Image progress ${progressCount}: ${ready}/${total} prompts ready in room ${room.code}`);
        
        io.to(roomId).emit(SocketEvents.IMAGE_PROGRESS, {
          roomId,
          game: serializeGame(room.game),
        } as ImageProgressEvent);
      }
      
      // Small delay to ensure updates are visible
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    const updatedRoom = result.room;
    const rejectedPlayerIds = result.rejectedPlayerIds;
    
    // If any prompts were rejected, notify those players
    if (rejectedPlayerIds.length > 0) {
      logger.info(`Notifying ${rejectedPlayerIds.length} players of content policy violations in room ${roomId}`);
      
      for (const playerId of rejectedPlayerIds) {
        const player = updatedRoom.players.get(playerId);
        if (player) {
          // Find the player's socket and emit rejection event
          const playerSockets = await io.in(roomId).fetchSockets();
          const playerSocket = playerSockets.find(s => 
            s.data.playerId === playerId || s.handshake.auth?.playerId === playerId
          );
          
          if (playerSocket) {
            playerSocket.emit(SocketEvents.PROMPT_REJECTED, {
              playerId,
              reason: 'Your prompt was rejected by our content safety system. Please try a different prompt.',
            });
            logger.info(`Sent PROMPT_REJECTED to player ${playerId} in room ${roomId}`);
          }
        }
      }
      
      // Don't transition - stay in image_generate phase
      return;
    }
    
    if (updatedRoom.game) {
      // Notify all players that images are ready and phase changed to image_select
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: 'image_select',
      } as PhaseTransitionEvent);
      
      logger.info(`Image generation complete for room ${roomId}, transitioned to image_select`);
    }
  } catch (error) {
    logger.error(`Error generating images for room ${roomId}:`, error);
    
    // Emit error event to all clients in the room
    io.to(roomId).emit(SocketEvents.ERROR, {
      code: 'IMAGE_GENERATION_FAILED',
      message: 'Failed to generate images. Please try starting a new round.',
      context: { roomId },
    });
  }
}

/**
 * Handle player selecting an image.
 */
async function handleSelectImage(
  io: Server,
  socket: Socket,
  data: any
): Promise<void> {
  try {
    const { roomId, playerId, imageId } = data;

    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYER_NOT_IN_ROOM',
        message: 'Player not found in room',
      });
      return;
    }

    logger.info(`Player ${player.displayName} selecting image in room ${room.code}`);

    // Submit the image selection
    const { room: updatedRoom, allSelected } = await roomService.selectImage(roomId, playerId, imageId);

    // If all players selected, broadcast phase transition
    if (allSelected && updatedRoom.game) {
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: 'reveal_guess',
      } as PhaseTransitionEvent);
    }
  } catch (error) {
    logger.error('Error in handleSelectImage:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'SELECT_IMAGE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to select image',
    });
  }
}

/**
 * Handle player submitting a guess.
 */
async function handleSubmitGuess(
  io: Server,
  socket: Socket,
  data: SubmitGuessEvent
): Promise<void> {
  try {
    const { roomId, playerId, imageId, guessText } = data;

    // Get the room
    const room = await getRoomById(roomId);
    if (!room) {
      socket.emit(SocketEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
      return;
    }

    // Verify player is in the room
    const player = room.players.get(playerId);
    if (!player) {
      socket.emit(SocketEvents.ERROR, {
        code: 'PLAYER_NOT_IN_ROOM',
        message: 'Player not found in room',
      });
      return;
    }

    logger.info(`Player ${player.displayName} submitting guess in room ${room.code}`);

    // Submit the guess
    const { room: updatedRoom, allGuessed } = await roomService.submitGuess(
      roomId,
      playerId,
      imageId,
      guessText
    );

    if (allGuessed && updatedRoom.game) {
      const currentRound = updatedRoom.game.rounds[updatedRoom.game.currentRound - 1];
      
      // Check if we advanced to next image or transitioned to scoring
      if (currentRound.status === 'scoring') {
        // All images revealed - calculate scores
        const scoredRoom = await roomService.scoreRound(roomId);
        
        if (scoredRoom.game) {
          io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
            roomId,
            game: serializeGame(scoredRoom.game),
            newPhase: scoredRoom.game.status, // 'round_end' or 'game_end'
          } as PhaseTransitionEvent);
        }
      } else {
        // Advanced to next image - emit phase transition to trigger re-render
        io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
          roomId,
          game: serializeGame(updatedRoom.game),
          newPhase: 'reveal_guess', // Still in reveal phase, but with updated index
        } as PhaseTransitionEvent);
      }
    }
  } catch (error) {
    logger.error('Error in handleSubmitGuess:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'SUBMIT_GUESS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to submit guess',
    });
  }
}

/**
 * Handle navigating results during reveal phase.
 */
async function handleNavigateResult(
  io: Server,
  socket: Socket,
  data: NavigateResultEvent
): Promise<void> {
  try {
    const { roomId, playerId, direction } = data;

    logger.info(`Player ${playerId} navigating ${direction} in room ${roomId}`);

    // Validate room and player
    const room = await getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Navigate to next/previous result
    const updatedRoom = await roomService.navigateResult(roomId, direction);

    if (updatedRoom.game) {
      // Broadcast phase transition to update all clients with new index
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: updatedRoom.game.status,
      } as PhaseTransitionEvent);
    }
  } catch (error) {
    logger.error('Error in handleNavigateResult:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'NAVIGATE_RESULT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to navigate result',
    });
  }
}

/**
 * Handle completing the reveal phase and transitioning to next round or game end.
 */
async function handleCompleteReveal(
  io: Server,
  socket: Socket,
  data: CompleteRevealEvent
): Promise<void> {
  try {
    const { roomId, playerId } = data;

    logger.info(`Player ${playerId} completing reveal in room ${roomId}`);

    // Validate room and player
    const room = await getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Complete the reveal phase
    const updatedRoom = await roomService.completeReveal(roomId);

    if (updatedRoom.game) {
      // Broadcast phase transition (round_end or game_end)
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: updatedRoom.game.status,
      } as PhaseTransitionEvent);
    }
  } catch (error) {
    logger.error('Error in handleCompleteReveal:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'COMPLETE_REVEAL_FAILED',
      message: error instanceof Error ? error.message : 'Failed to complete reveal',
    });
  }
}

/**
 * Handle host starting the next round.
 */
async function handleNextRound(
  io: Server,
  socket: Socket,
  data: NextRoundEvent
): Promise<void> {
  try {
    const { roomId, playerId } = data;

    logger.info(`Player ${playerId} starting next round in room ${roomId}`);

    // Validate room and player
    const room = await getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Start next round (validates host permission)
    const updatedRoom = await roomService.startNextRound(roomId, playerId);

    if (updatedRoom.game) {
      // Broadcast phase transition to prompt_submit
      io.to(roomId).emit(SocketEvents.PHASE_TRANSITION, {
        roomId,
        game: serializeGame(updatedRoom.game),
        newPhase: updatedRoom.game.status,
      } as PhaseTransitionEvent);

      logger.info(`Started round ${updatedRoom.game.currentRound} in room ${roomId}`);
    }
  } catch (error) {
    logger.error('Error in handleNextRound:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'NEXT_ROUND_FAILED',
      message: error instanceof Error ? error.message : 'Failed to start next round',
    });
  }
}

/**
 * Handle player disconnection.
 */
async function handleDisconnect(
  io: Server,
  socket: Socket,
  roomId: string | undefined,
  playerId: string | undefined
): Promise<void> {
  if (!roomId || !playerId) {
    return;
  }

  try {
    // Mark player as disconnected
    await roomService.updatePlayerConnection(roomId, playerId, false);

    const room = await getRoomById(roomId);
    if (!room) {
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      return;
    }

    logger.info(`Player ${player.displayName} disconnected from room ${room.code}`);

    // Notify other players
    io.to(roomId).emit(SocketEvents.PLAYER_LEFT, {
      playerId,
      playerName: player.displayName,
      reason: 'disconnect',
    } as PlayerLeftEvent);

    // Send updated room state
    io.to(roomId).emit(SocketEvents.ROOM_UPDATE, {
      room: serializeRoom(room),
    } as RoomUpdateEvent);
  } catch (error) {
    logger.error('Error in handleDisconnect:', error);
  }
}

/**
 * Serialize room for sending to clients.
 * Converts Map to plain object.
 */
function serializeRoom(room: any): any {
  return {
    ...room,
    players: Object.fromEntries(room.players),
  };
}

/**
 * Serialize game for sending to clients.
 * Converts all nested Maps to plain objects.
 */
function serializeGame(game: any): any {
  return {
    ...game,
    leaderboard: {
      scores: Object.fromEntries(game.leaderboard.scores),
      rankings: game.leaderboard.rankings,
    },
    rounds: game.rounds.map((round: any) => ({
      ...round,
      prompts: Object.fromEntries(round.prompts),
      selections: Object.fromEntries(round.selections),
      guesses: serializeNestedGuesses(round.guesses),
      bonusPoints: Object.fromEntries(round.bonusPoints),
      scores: Object.fromEntries(round.scores),
    })),
  };
}

/**
 * Serialize nested guesses Map structure.
 * Converts Map<imageId, Map<playerId, Guess>> to array format:
 * [[imageId, {playerId: guess, ...}], ...]
 */
function serializeNestedGuesses(guesses: Map<string, Map<string, any>>): any[] {
  return Array.from(guesses.entries()).map((entry: any) => [
    entry[0], // imageId
    Object.fromEntries(entry[1]) // Convert inner Map to object
  ]);
}

/**
 * Register all socket event handlers.
 */
export function registerRoomHandlers(io: Server, socket: Socket): void {
  let currentRoomId: string | undefined;
  let currentPlayerId: string | undefined;

  // Store room and player ID from auth
  socket.on(SocketEvents.JOIN_ROOM, async (data: JoinRoomEvent) => {
    currentRoomId = data.roomId;
    currentPlayerId = data.playerId;
    await handleJoinRoom(io, socket, data);
  });

  socket.on(SocketEvents.PLAYER_READY, (data: PlayerReadyEvent) => {
    handlePlayerReady(io, socket, data);
  });

  socket.on(SocketEvents.START_GAME, (data: any) => {
    handleStartGame(io, socket, data);
  });

  socket.on(SocketEvents.SUBMIT_PROMPT, (data: SubmitPromptEvent) => {
    handleSubmitPrompt(io, socket, data);
  });

  socket.on(SocketEvents.RESUBMIT_PROMPT, (data: ResubmitPromptEvent) => {
    handleResubmitPrompt(io, socket, data);
  });

  socket.on(SocketEvents.SELECT_IMAGE, (data: any) => {
    handleSelectImage(io, socket, data);
  });

  socket.on(SocketEvents.SUBMIT_GUESS, (data: SubmitGuessEvent) => {
    handleSubmitGuess(io, socket, data);
  });

  socket.on(SocketEvents.NAVIGATE_RESULT, (data: NavigateResultEvent) => {
    handleNavigateResult(io, socket, data);
  });

  socket.on(SocketEvents.COMPLETE_REVEAL, (data: any) => {
    handleCompleteReveal(io, socket, data);
  });

  socket.on(SocketEvents.NEXT_ROUND, (data: NextRoundEvent) => {
    handleNextRound(io, socket, data);
  });

  socket.on('disconnect', () => {
    handleDisconnect(io, socket, currentRoomId, currentPlayerId);
  });
}
