'use client';

import { Room, Player, Game, ImageSelection } from '@/shared/types';
import { useState } from 'react';

interface RevealGuessProps {
  room: Room;
  game: Game;
  currentPlayer: Player;
  onSubmitGuess: (imageId: string, guessText: string) => void;
}

export default function RevealGuess({
  room,
  game,
  currentPlayer,
  onSubmitGuess,
}: RevealGuessProps) {
  const [guessText, setGuessText] = useState('');

  const currentRound = game.rounds[game.currentRound - 1];
  if (!currentRound) {
    return <div>Error: No current round</div>;
  }

  // Use currentRevealIndex from backend to show the right image
  const currentImageIndex = currentRound.currentRevealIndex;

  // Get all selected images from the round
  const selectedImages = Array.from(currentRound.selections.values())
    .map((selection: ImageSelection) => {
      // Find the image from the prompt submissions
      const prompt = currentRound.prompts.get(selection.playerId);
      if (!prompt) return null;
      
      const image = prompt.images.find((img: any) => img.id === selection.imageId);
      if (!image) return null;

      return {
        ...image,
        submitterId: selection.playerId,
      };
    })
    .filter((img): img is NonNullable<typeof img> => img !== null);

  if (selectedImages.length === 0) {
    return <div>Error: No selected images found</div>;
  }

  const currentImage = selectedImages[currentImageIndex];
  if (!currentImage) {
    return <div>Error: Invalid image index</div>;
  }

  const isMyImage = currentImage.submitterId === currentPlayer.id;

  // Get guesses for current image
  const imageGuesses = currentRound.guesses.get(currentImage.id);
  const hasGuessed = imageGuesses?.has(currentPlayer.id) ?? false;
  const guessCount = imageGuesses?.size ?? 0;
  const totalPlayers = room.players.size;
  const expectedGuesses = isMyImage ? totalPlayers - 1 : totalPlayers;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guessText.trim() && !hasGuessed && !isMyImage) {
      onSubmitGuess(currentImage.id, guessText.trim());
      setGuessText('');
    }
  };

  const renderGuessSection = () => {
    if (isMyImage) {
      return (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-2">This is your image!</p>
          <p className="text-sm text-gray-500">
            Waiting for others to guess...
          </p>
        </div>
      );
    }

    if (hasGuessed) {
      return (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-green-500 text-4xl mb-2">✓</div>
          <p className="text-gray-400 mb-2">Guess submitted!</p>
          <p className="text-sm text-gray-500">
            Waiting for other players...
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
        <label
          htmlFor="guess-input"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          What was the prompt?
        </label>
        <input
          id="guess-input"
          type="text"
          value={guessText}
          onChange={(e) => setGuessText(e.target.value)}
          placeholder="Enter your guess..."
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
          maxLength={200}
          minLength={3}
          autoFocus
        />
        <button
          type="submit"
          disabled={guessText.trim().length < 3}
          className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          Submit Guess
        </button>
      </form>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Guess the Prompt
        </h2>
        <p className="text-gray-400">
          Image {currentImageIndex + 1} of {selectedImages.length}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Round {game.currentRound}
        </p>
      </div>

      {/* Image Display */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="aspect-square w-full max-w-md mx-auto bg-gray-900 rounded-lg overflow-hidden">
          <img
            src={currentImage.imageUrl || ''}
            alt={`Revealed prompt ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Guess Input or Status */}
      {renderGuessSection()}

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Guesses submitted</span>
          <span>
            {guessCount}/{expectedGuesses}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{
              width: `${(guessCount / expectedGuesses) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
