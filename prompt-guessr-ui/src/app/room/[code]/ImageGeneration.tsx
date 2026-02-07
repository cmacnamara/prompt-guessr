'use client';

import { useState } from 'react';
import { Game } from '@/shared/types/game';

interface ImageGenerationProps {
  game: Game;
  playerId: string;
  promptRejected: boolean;
  promptRejectionReason: string;
  onResubmitPrompt: (prompt: string) => void;
}

/**
 * Component displayed during image generation phase.
 * Shows a loading state while AI generates images for all prompts.
 * If a prompt is rejected, shows a resubmission form.
 */
export default function ImageGeneration({ 
  game, 
  playerId,
  promptRejected,
  promptRejectionReason,
  onResubmitPrompt,
}: ImageGenerationProps) {
  const [newPrompt, setNewPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRound = game.rounds[game.currentRound - 1];
  
  if (!currentRound) {
    return <div>No active round</div>;
  }

  // Check current player's status
  const currentPlayerPrompt = currentRound.prompts.get(playerId);
  const isCurrentPlayerRejected = currentPlayerPrompt?.status === 'rejected' || promptRejected;

  // Handle prompt resubmission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim() || newPrompt.length < 10) return;

    setIsSubmitting(true);
    onResubmitPrompt(newPrompt);
    setNewPrompt('');
    // Don't reset isSubmitting here - let the rejection state update handle it
  };

  // If rejected, show resubmission form
  if (isCurrentPlayerRejected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-red-600">Content Policy Violation</h1>
          <p className="text-gray-800">
            Your prompt was rejected by our content safety system
          </p>
        </div>

        {/* Error Message */}
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Prompt Rejected
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{promptRejectionReason}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resubmission Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Submit a New Prompt</h2>
          <p className="text-gray-800 mb-6">
            Please enter a different prompt that follows our content guidelines.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Enter a different image prompt..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                rows={4}
                maxLength={200}
                disabled={isSubmitting}
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-700">
                  {newPrompt.length}/200 characters
                </span>
                <span className="text-sm text-gray-700">
                  Minimum 10 characters
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!newPrompt.trim() || newPrompt.length < 10 || isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit New Prompt'}
            </button>
          </form>
        </div>

        {/* Round Info */}
        <div className="text-center mt-8 text-sm text-gray-700">
          Round {game.currentRound} of {game.rounds.length || 3}
        </div>
      </div>
    );
  }

  // Count how many images are in each status across all prompts
  const promptStatuses = Array.from(currentRound.prompts.values());
  
  // Calculate total images and completed images
  let totalImages = 0;
  let completedImages = 0;
  
  promptStatuses.forEach(prompt => {
    const imageCount = prompt.images?.length || 0;
    totalImages += imageCount;
    
    // Count completed images (status 'complete')
    if (prompt.images) {
      completedImages += prompt.images.filter(img => img.status === 'complete').length;
    }
  });

  // Use existing currentPlayerPrompt from line 36
  const currentPlayerReady = currentPlayerPrompt?.status === 'ready';
  const playerImageCount = currentPlayerPrompt?.images?.length || 4;
  
  // Count for status text
  const ready = promptStatuses.filter(p => p.status === 'ready').length;
  const allReady = ready === promptStatuses.length && completedImages === totalImages;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Generating Images...</h1>
        <p className="text-gray-800">
          Our AI is creating images from your prompts
        </p>
      </div>

      {/* Status Message */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Loading Spinner (only show when not ready) */}
          {!currentPlayerReady && (
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          
          {/* Checkmark (show when ready) */}
          {currentPlayerReady && !allReady && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {/* All ready checkmark */}
          {allReady && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Status Messages */}
          <div className="text-center">
            {!currentPlayerReady && (
              <p className="text-xl font-semibold text-gray-800">
                Generating {playerImageCount} images based on your prompt...
              </p>
            )}
            {currentPlayerReady && !allReady && (
              <>
                <p className="text-xl font-semibold text-green-600 mb-2">
                  ✓ Your images are ready!
                </p>
                <p className="text-gray-600">
                  Waiting for other players&apos; images to finish...
                </p>
              </>
            )}
            {allReady && (
              <>
                <p className="text-xl font-semibold text-green-600 mb-2">
                  ✓ All images ready!
                </p>
                <p className="text-gray-600">
                  Proceeding to selection...
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading Animation */}
      <div className="flex justify-center">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg animate-pulse"
              style={{
                animationDelay: `${i * 150}ms`,
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round Info */}
      <div className="text-center mt-8 text-sm text-gray-500">
        Round {game.currentRound} of {game.rounds.length || 3}
      </div>
    </div>
  );
}
