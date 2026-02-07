import { useEffect, useState } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket-client';
import { deserializeRoom } from '@/lib/utils/room-utils';
import { deserializeGame } from '@/lib/utils/game-utils';
import * as roomApi from '@/lib/api/room-api';
import {   Room,
  Game,
  SocketEvents,
  RoomUpdateEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerReadyChangedEvent,
  GameStartedEvent,
  PromptSubmittedEvent,
  PromptRejectedEvent,
  PhaseTransitionEvent,
  ImageProgressEvent,
} from '@/shared/types';

interface UseRoomOptions {
  roomCode: string;
  playerId: string | null;
}

interface UseRoomReturn {
  room: Room | null;
  game: Game | null;
  isConnecting: boolean;
  error: string;
  promptRejected: boolean;
  promptRejectionReason: string;
  handleToggleReady: () => void;
  handleStartGame: () => void;
  handleSubmitPrompt: (prompt: string) => void;
  handleResubmitPrompt: (prompt: string) => void;
  handleSelectImage: (imageId: string) => void;
  handleSubmitGuess: (imageId: string, guessText: string) => void;
  handleNavigateResult: (direction: 'next' | 'previous') => void;
  handleCompleteReveal: () => void;
  handleNextRound: () => void;
}

export function useRoom({ roomCode, playerId }: UseRoomOptions): UseRoomReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string>('');
  const [promptRejected, setPromptRejected] = useState(false);
  const [promptRejectionReason, setPromptRejectionReason] = useState<string>('');

  // Fetch initial room data
  useEffect(() => {
    if (!playerId) return;

    async function fetchRoom() {
      try {
        const { room: roomData } = await roomApi.getRoomByCode(roomCode);
        setRoom(deserializeRoom(roomData));
        setError('');
      } catch (err) {
        console.error('Failed to fetch room:', err);
        setError(err instanceof Error ? err.message : 'Failed to load room');
        setIsConnecting(false);
      }
    }

    fetchRoom();
  }, [playerId, roomCode]);

  // Set up socket connection and event listeners
  useEffect(() => {
    if (!playerId || !room?.id) {
      return;
    }

    const socket = getSocket();
    
    // Event handlers
    const handleRoomUpdate = (data: RoomUpdateEvent) => {
      console.log('Room update:', data);
      setRoom(deserializeRoom(data.room));
      setIsConnecting(false);
    };

    const handlePlayerJoined = (data: PlayerJoinedEvent) => {
      console.log('Player joined:', data.player.displayName);
      setRoom(deserializeRoom(data.room));
    };

    const handlePlayerLeft = (data: PlayerLeftEvent) => {
      console.log('Player left:', data.playerName);
    };

    const handlePlayerReadyChanged = (data: PlayerReadyChangedEvent) => {
      console.log(`${data.playerName} ready: ${data.isReady}`);
    };

    const handleGameStarted = (data: GameStartedEvent) => {
      console.log('Game started:', data);
      setGame(deserializeGame(data.game));
    };

    const handlePromptSubmitted = (data: PromptSubmittedEvent) => {
      console.log(`${data.playerName} submitted a prompt`);
    };

    const handlePromptRejected = (data: PromptRejectedEvent) => {
      console.log('Prompt rejected:', data.reason);
      if (data.playerId === playerId) {
        setPromptRejected(true);
        setPromptRejectionReason(data.reason);
      }
    };

    const handlePhaseTransition = (data: PhaseTransitionEvent) => {
      console.log(`Phase transition to ${data.newPhase}`);
      setGame(deserializeGame(data.game));
    };

    const handleImageProgress = (data: ImageProgressEvent) => {
      console.log('Image generation progress update');
      setGame(deserializeGame(data.game));
    };

    const handleError = (data: any) => {
      console.error('Socket error:', data);
      setError(data.message);
    };

    // Register event listeners
    socket.on(SocketEvents.ROOM_UPDATE, handleRoomUpdate);
    socket.on(SocketEvents.PLAYER_JOINED, handlePlayerJoined);
    socket.on(SocketEvents.PLAYER_LEFT, handlePlayerLeft);
    socket.on(SocketEvents.PLAYER_READY_CHANGED, handlePlayerReadyChanged);
    socket.on(SocketEvents.GAME_STARTED, handleGameStarted);
    socket.on(SocketEvents.PROMPT_SUBMITTED, handlePromptSubmitted);
    socket.on(SocketEvents.PROMPT_REJECTED, handlePromptRejected);
    socket.on(SocketEvents.PHASE_TRANSITION, handlePhaseTransition);
    socket.on(SocketEvents.IMAGE_PROGRESS, handleImageProgress);
    socket.on(SocketEvents.ERROR, handleError);

    // Connect and join room
    connectSocket(room.id, playerId);
    socket.emit(SocketEvents.JOIN_ROOM, {
      roomId: room.id,
      playerId,
    });

    // Cleanup
    return () => {
      socket.off(SocketEvents.ROOM_UPDATE, handleRoomUpdate);
      socket.off(SocketEvents.PLAYER_JOINED, handlePlayerJoined);
      socket.off(SocketEvents.PLAYER_LEFT, handlePlayerLeft);
      socket.off(SocketEvents.PLAYER_READY_CHANGED, handlePlayerReadyChanged);
      socket.off(SocketEvents.GAME_STARTED, handleGameStarted);
      socket.off(SocketEvents.PROMPT_SUBMITTED, handlePromptSubmitted);
      socket.off(SocketEvents.PROMPT_REJECTED, handlePromptRejected);
      socket.off(SocketEvents.PHASE_TRANSITION, handlePhaseTransition);
      socket.off(SocketEvents.IMAGE_PROGRESS, handleImageProgress);
      socket.off(SocketEvents.ERROR, handleError);
      disconnectSocket();
    };
  }, [playerId, room?.id]);

  // Handler for toggling ready state
  const handleToggleReady = () => {
    if (!room || !playerId) return;

    const socket = getSocket();
    const currentPlayer = room.players.get(playerId);
    
    socket.emit(SocketEvents.PLAYER_READY, {
      roomId: room.id,
      playerId,
      isReady: !currentPlayer?.isReady,
    });
  };

  // Handler for starting the game
  const handleStartGame = () => {
    if (!room || !playerId) return;

    const socket = getSocket();
    socket.emit(SocketEvents.START_GAME, {
      roomId: room.id,
      playerId,
    });
  };

  // Handler for submitting a prompt
  const handleSubmitPrompt = (prompt: string) => {
    if (!room || !playerId || !game) return;

    const socket = getSocket();
    socket.emit(SocketEvents.SUBMIT_PROMPT, {
      roomId: room.id,
      playerId,
      prompt,
    });

    // Optimistically update local game state for instant UI feedback
    const currentRound = game.rounds[game.currentRound - 1];
    if (currentRound) {
      currentRound.prompts.set(playerId, {
        playerId,
        prompt,
        submittedAt: Date.now(),
        images: [],
        status: 'pending',
      });
      setGame({ ...game });
    }
  };

  // Handler for resubmitting a rejected prompt
  const handleResubmitPrompt = (prompt: string) => {
    if (!room || !playerId || !game) return;

    const socket = getSocket();
    socket.emit(SocketEvents.RESUBMIT_PROMPT, {
      roomId: room.id,
      playerId,
      prompt,
    });

    // Clear rejection state and update prompt submission
    setPromptRejected(false);
    setPromptRejectionReason('');

    // Optimistically update local game state
    const currentRound = game.rounds[game.currentRound - 1];
    if (currentRound) {
      const existingSubmission = currentRound.prompts.get(playerId);
      if (existingSubmission) {
        existingSubmission.prompt = prompt;
        existingSubmission.status = 'generating';
        existingSubmission.submittedAt = Date.now();
        setGame({ ...game });
      }
    }
  };

  // Handler for selecting an image
  const handleSelectImage = (imageId: string) => {
    if (!room || !playerId || !game) return;

    const socket = getSocket();
    socket.emit(SocketEvents.SELECT_IMAGE, {
      roomId: room.id,
      playerId,
      imageId,
    });

    // Optimistically update local game state
    const currentRound = game.rounds[game.currentRound - 1];
    if (currentRound) {
      currentRound.selections.set(playerId, {
        playerId,
        imageId,
        selectedAt: Date.now(),
      });
      setGame({ ...game });
    }
  };

  // Handler for submitting a guess
  const handleSubmitGuess = (imageId: string, guessText: string) => {
    if (!room || !playerId || !game) return;

    const socket = getSocket();
    socket.emit(SocketEvents.SUBMIT_GUESS, {
      roomId: room.id,
      playerId,
      imageId,
      guessText,
    });

    // Optimistically update local game state
    const currentRound = game.rounds[game.currentRound - 1];
    if (currentRound) {
      let imageGuesses = currentRound.guesses.get(imageId);
      if (!imageGuesses) {
        imageGuesses = new Map();
        currentRound.guesses.set(imageId, imageGuesses);
      }
      imageGuesses.set(playerId, {
        id: `${Date.now()}`,
        imageId,
        playerId,
        guessText,
        submittedAt: Date.now(),
      });
      setGame({ ...game });
    }
  };

  // Handler for completing the reveal phase
  const handleCompleteReveal = () => {
    if (!room || !playerId) return;

    const socket = getSocket();
    socket.emit(SocketEvents.COMPLETE_REVEAL, {
      roomId: room.id,
      playerId,
    });
  };

  // Handler for navigating results (next/previous)
  const handleNavigateResult = (direction: 'next' | 'previous') => {
    if (!room || !playerId) return;

    const socket = getSocket();
    socket.emit(SocketEvents.NAVIGATE_RESULT, {
      roomId: room.id,
      playerId,
      direction,
    });
  };

  // Handler for starting the next round
  const handleNextRound = () => {
    if (!room || !playerId) return;

    const socket = getSocket();
    socket.emit(SocketEvents.NEXT_ROUND, {
      roomId: room.id,
      playerId,
    });
  };

  return {
    room,
    game,
    isConnecting,
    error,
    promptRejected,
    promptRejectionReason,
    handleToggleReady,
    handleStartGame,
    handleSubmitPrompt,
    handleResubmitPrompt,
    handleSelectImage,
    handleSubmitGuess,
    handleNavigateResult,
    handleCompleteReveal,
    handleNextRound,
  };
}
