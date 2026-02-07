'use client';

import { useState } from 'react';
import { Game } from '@/shared/types/game';
import { GeneratedImage } from '@/shared/types/prompt';

interface ImageSelectionProps {
  game: Game;
  playerId: string;
  playerName: string;
  onSelectImage: (imageId: string) => void;
}

/**
 * Component for players to select their favorite image from their generated set.
 * Each player privately chooses 1 of their 4 generated images.
 */
export default function ImageSelection({
  game,
  playerId,
  playerName,
  onSelectImage,
}: ImageSelectionProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const currentRound = game.rounds[game.currentRound - 1];
  
  if (!currentRound) {
    return <div>No active round</div>;
  }

  // Get this player's prompt submission with generated images
  const myPromptSubmission = currentRound.prompts.get(playerId);
  
  if (!myPromptSubmission) {
    return <div>No prompt submission found</div>;
  }

  const myImages = myPromptSubmission.images || [];
  const hasSelected = currentRound.selections.has(playerId);

  const handleImageClick = (imageId: string) => {
    if (hasSubmitted || hasSelected) return;
    setSelectedImageId(imageId);
  };

  const handleSubmit = () => {
    if (!selectedImageId || hasSubmitted || hasSelected) return;
    setHasSubmitted(true);
    onSelectImage(selectedImageId);
  };

  // Count how many players have selected
  const totalPlayers = currentRound.prompts.size;
  const playersSelected = currentRound.selections.size;

  // If already selected, show waiting state
  if (hasSubmitted || hasSelected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Image Selected!
              </h2>
              <p className="text-gray-800">
                Waiting for other players to choose their images...
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-800 font-medium">Players ready</span>
                <span className="font-semibold text-gray-900">{playersSelected} / {totalPlayers}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-500"
                  style={{ width: `${(playersSelected / totalPlayers) * 100}%` }}
                />
              </div>
            </div>

            <div className="text-sm text-gray-700 font-medium mt-6">
              Round {game.currentRound}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Favorite</h1>
        <p className="text-gray-800">
          Select the best image from your prompt: <span className="font-semibold">"{myPromptSubmission.prompt}"</span>
        </p>
      </div>

      {/* Image Grid */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="grid grid-cols-2 gap-6">
          {myImages.map((image: GeneratedImage, index: number) => (
            <button
              key={image.id}
              type="button"
              onClick={() => handleImageClick(image.id)}
              className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                selectedImageId === image.id
                  ? 'ring-4 ring-purple-500 scale-105'
                  : 'hover:ring-2 hover:ring-gray-300 hover:scale-102'
              }`}
              aria-label={`Select option ${index + 1}`}
              aria-pressed={selectedImageId === image.id}
            >
              <div className="aspect-square bg-gray-100">
                {image.imageUrl ? (
                  <img
                    src={image.imageUrl}
                    alt={`Option ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 font-medium">
                    Image {index + 1}
                  </div>
                )}
              </div>
              
              {selectedImageId === image.id && (
                <div className="absolute top-3 right-3 bg-purple-500 text-white rounded-full p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                <p className="text-white text-sm font-medium">
                  Option {index + 1}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!selectedImageId}
          className={`px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
            selectedImageId
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-300 text-gray-700 cursor-not-allowed'
          }`}
        >
          {selectedImageId ? 'Confirm Selection' : 'Select an Image'}
        </button>
      </div>

      {/* Round Info */}
      <div className="text-center mt-8 text-sm text-gray-700 font-medium">
        Round {game.currentRound} of {game.rounds.length || 3}
      </div>
    </div>
  );
}
