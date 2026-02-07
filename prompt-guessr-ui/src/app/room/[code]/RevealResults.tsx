'use client';

import { useState } from 'react';
import { Room, Game } from '@/shared/types';

interface GuessRevealProps {
  room: Room;
  game: Game;
  onNavigate: (direction: 'next' | 'previous') => void;
  onContinue: () => void;
}

export default function GuessReveal({
  room,
  game,
  onNavigate,
  onContinue,
}: GuessRevealProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const currentRound = game.rounds[game.currentRound - 1];
  if (!currentRound) {
    return <div>Error: No current round</div>;
  }

  // Use server-controlled index instead of local state
  const currentImageIndex = currentRound.currentResultIndex;

  // Get all selected images with their prompts and guesses
  const revealData = Array.from(currentRound.selections.values())
    .map((selection) => {
      const prompt = currentRound.prompts.get(selection.playerId);
      if (!prompt) return null;
      
      const image = prompt.images.find((img: any) => img.id === selection.imageId);
      if (!image) return null;

      const player = room.players.get(selection.playerId);
      
      // Get guesses for this image
      const imageGuesses = currentRound.guesses.get(selection.imageId);
      const guesses = imageGuesses ? Array.from(imageGuesses.entries()).map(([playerId, guess]) => {
        const guesser = room.players.get(playerId);
        return {
          playerId,
          playerName: guesser?.displayName || 'Unknown',
          guessText: guess.guessText,
          score: guess.score || 0, // Get the score from the backend
        };
      }) : [];

      return {
        imageId: selection.imageId,
        imageUrl: image.imageUrl,
        originalPrompt: prompt.prompt,
        submitterId: selection.playerId,
        submitterName: player?.displayName || 'Unknown',
        guesses: guesses.sort((a, b) => b.score - a.score), // Sort by score descending
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (revealData.length === 0) {
    return <div>No images to reveal</div>;
  }

  const currentReveal = revealData[currentImageIndex];
  const isLastImage = currentImageIndex >= revealData.length - 1;
  const isFirstImage = currentImageIndex === 0;

  // Check if this image earned bonus points
  const bonusPoints = currentRound.bonusPoints.get(currentReveal.imageId) || 0;

  // Get similarity color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500';
    return 'bg-red-500/20 border-red-500';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          The Reveal
        </h2>
        <p className="text-gray-400">
          Image {currentImageIndex + 1} of {revealData.length}
        </p>
      </div>

      {/* Image and Original Prompt */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="aspect-square w-full max-w-md mx-auto bg-gray-900 rounded-lg overflow-hidden mb-4">
          <img
            src={currentReveal.imageUrl || ''}
            alt={`Generated from prompt ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Original Prompt by {currentReveal.submitterName}</p>
          <p className="text-xl font-bold text-white bg-purple-600/30 px-4 py-3 rounded-lg border border-purple-500">
            "{currentReveal.originalPrompt}"
          </p>
          {bonusPoints > 0 && (
            <div className="mt-3 inline-block bg-yellow-500/20 border border-yellow-500 rounded-lg px-4 py-2">
              <p className="text-yellow-400 font-semibold text-sm">
                🎉 Bonus! +{bonusPoints} points for stumping everyone!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Guesses */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Everyone's Guesses</h3>
        
        {currentReveal.guesses.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No guesses for this image</p>
        ) : (
          <div className="space-y-3">
            {currentReveal.guesses.map((guess, index) => (
              <div
                key={guess.playerId}
                className={`border rounded-lg p-4 ${getScoreBgColor(guess.score)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-white">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{guess.playerName}</p>
                      <p className="text-gray-300 italic">"{guess.guessText}"</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getScoreColor(guess.score)}`}>
                      {guess.score}%
                    </p>
                    <p className="text-xs text-gray-400">similarity</p>
                  </div>
                </div>
                
                {/* Similarity indicator */}
                <div className="mt-2">
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        guess.score >= 80 ? 'bg-green-500' :
                        guess.score >= 60 ? 'bg-yellow-500' :
                        guess.score >= 40 ? 'bg-orange-500' :
                        'bg-red-500'
                      } transition-all duration-500`}
                      style={{ width: `${guess.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center gap-4">
        <button
          onClick={() => onNavigate('previous')}
          disabled={isFirstImage || isTransitioning}
          className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
            isFirstImage || isTransitioning
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          ← Previous
        </button>

        <div className="text-center text-gray-400 text-sm">
          Image {currentImageIndex + 1} of {revealData.length}
        </div>

        {isLastImage ? (
          <button
            onClick={() => {
              setIsTransitioning(true);
              onContinue();
            }}
            disabled={isTransitioning}
            className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
              isTransitioning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isTransitioning ? 'Loading...' : 'Continue to Results'}
          </button>
        ) : (
          <button
            onClick={() => onNavigate('next')}
            disabled={isTransitioning}
            className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
              isTransitioning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
