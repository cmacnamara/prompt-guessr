'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import Lobby from './Lobby';
import PromptSubmission from './PromptSubmission';
import ImageGeneration from './ImageGeneration';
import ImageSelection from './ImageSelection';
import GuessingPhase from './GuessingPhase';
import RevealResults from './RevealResults';
import RoundResults from './RoundResults';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.code as string;
  
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    // Get player ID from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    if (!storedPlayerId) {
      // Redirect to home if no player ID
      router.push('/');
      return;
    }
    setPlayerId(storedPlayerId);
  }, [router]);

  const { 
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
    handleNextRound 
  } = useRoom({
    roomCode,
    playerId,
  });

  const currentPlayer = room?.players.get(playerId || '');
  const isHost = currentPlayer?.isHost ?? false;

  /**
   * Render the appropriate component based on game phase
   */
  const renderGamePhase = () => {
    console.log('renderGamePhase - game status:', game?.status, 'room status:', room?.status);
    
    // Prompt submission phase
    if (game?.status === 'prompt_submit' && currentPlayer && playerId) {
      return (
        <PromptSubmission
          game={game}
          playerId={playerId}
          playerName={currentPlayer.displayName}
          onSubmitPrompt={handleSubmitPrompt}
        />
      );
    }

    // Image generation phase
    if (game?.status === 'image_generate' && playerId) {
      return (
        <ImageGeneration 
          game={game} 
          playerId={playerId} 
          promptRejected={promptRejected}
          promptRejectionReason={promptRejectionReason}
          onResubmitPrompt={handleResubmitPrompt}
        />
      );
    }

    // Image selection phase
    if (game?.status === 'image_select' && currentPlayer && playerId) {
      return (
        <ImageSelection
          game={game}
          playerId={playerId}
          playerName={currentPlayer.displayName}
          onSelectImage={handleSelectImage}
        />
      );
    }

    // Reveal and guessing phase
    if (game?.status === 'reveal_guess' && room && currentPlayer) {
      return (
        <GuessingPhase
          room={room}
          game={game}
          currentPlayer={currentPlayer}
          onSubmitGuess={handleSubmitGuess}
        />
      );
    }

    // Reveal results phase (show prompts and scores)
    if (game?.status === 'reveal_results' && room) {
      return (
        <RevealResults
          room={room}
          game={game}
          onNavigate={handleNavigateResult}
          onContinue={handleCompleteReveal}
        />
      );
    }

    // Round results or game end
    if ((game?.status === 'round_end' || game?.status === 'game_end') && room) {
      return (
        <RoundResults
          room={room}
          game={game}
          currentPlayer={currentPlayer}
          isHost={isHost}
          onNextRound={handleNextRound}
        />
      );
    }

    // Lobby (default)
    if (room && currentPlayer) {
      return (
        <Lobby
          room={room}
          roomCode={roomCode}
          currentPlayer={currentPlayer}
          isHost={isHost}
          onToggleReady={handleToggleReady}
          onStartGame={handleStartGame}
        />
      );
    }

    return null;
  };

  if (isConnecting && !room) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-500 to-blue-600 p-4 flex items-center justify-center">
        <div className="text-white text-xl">Connecting...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-500 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">
              Prompt Guessr
            </h1>
            <div className="text-right">
              <p className="text-sm text-gray-600">Room Code</p>
              <p className="text-2xl font-bold text-purple-600">{roomCode}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        {renderGamePhase()}
      </div>
    </main>
  );
}
