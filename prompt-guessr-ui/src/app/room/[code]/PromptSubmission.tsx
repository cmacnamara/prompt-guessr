'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/shared/types';

interface PromptSubmissionProps {
  game: Game;
  playerId: string;
  playerName: string;
  onSubmitPrompt: (prompt: string) => void;
}

/**
 * Component for the prompt submission phase of the game.
 * Players enter creative prompts that will be used to generate images.
 */
export default function PromptSubmission({
  game,
  playerId,
  playerName,
  onSubmitPrompt,
}: PromptSubmissionProps) {
  const [prompt, setPrompt] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  const MAX_PROMPT_LENGTH = 200;
  const currentRound = game.rounds[game.currentRound - 1];
  
  // Check if current player has already submitted
  const hasSubmitted = currentRound?.prompts?.has(playerId) ?? false;
  
  // Count how many players have submitted
  const submittedCount = currentRound?.prompts?.size ?? 0;
  const totalPlayers = game.leaderboard.scores.size;

  // Initialize and update countdown timer
  useEffect(() => {
    if (!currentRound?.startedAt) return;

    // Calculate time remaining
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - currentRound.startedAt) / 1000);
      const remaining = Math.max(0, game.leaderboard.scores.size * 90 - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentRound?.startedAt, game]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (prompt.trim().length < 10) {
      alert('Prompt must be at least 10 characters long');
      return;
    }

    onSubmitPrompt(prompt.trim());
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800">
            Round {game.currentRound} - Submit Your Prompt
          </h2>
          <div className="text-lg font-semibold text-purple-600">
            ⏱️ {formatTime(timeRemaining)}
          </div>
        </div>
        <p className="text-gray-800">
          Enter a creative prompt for AI image generation. Be imaginative!
        </p>
      </div>

      {hasSubmitted ? (
        /* Show waiting state after submission */
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-xl font-semibold text-green-600 mb-2">
            Prompt Submitted!
          </h3>
          <p className="text-gray-800 mb-4">
            Waiting for other players...
          </p>
          <div className="text-sm text-gray-800 font-medium">
            {submittedCount} / {totalPlayers} players have submitted
          </div>
        </div>
      ) : (
        /* Show prompt input form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
              placeholder="Example: A majestic cat wearing a crown, sitting on a throne in a medieval castle"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={4}
              maxLength={MAX_PROMPT_LENGTH}
              autoFocus
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-800">
                Minimum 10 characters
              </span>
              <span className={`text-sm font-medium ${prompt.length > MAX_PROMPT_LENGTH - 20 ? 'text-orange-600' : 'text-gray-800'}`}>
                {prompt.length} / {MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={prompt.trim().length < 10}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
              prompt.trim().length >= 10
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            Submit Prompt
          </button>
        </form>
      )}

      {/* Player submission status */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">
          Submission Status ({submittedCount}/{totalPlayers})
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {Array.from(game.leaderboard.scores.values()).map((score) => {
            const submitted = currentRound?.prompts?.has(score.playerId) ?? false;
            return (
              <div
                key={score.playerId}
                className={`flex items-center gap-2 px-3 py-2 rounded ${
                  submitted ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${submitted ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-800">{score.displayName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
