'use client';

import { Room, Game, Player } from '@/shared/types';

interface RoundResultsProps {
  room: Room;
  game: Game;
  currentPlayer: Player | undefined;
  isHost: boolean;
  onNextRound: () => void;
}

export default function RoundResults({
  room,
  game,
  currentPlayer,
  isHost,
  onNextRound,
}: RoundResultsProps) {
  const currentRound = game.rounds[game.currentRound - 1];
  
  if (!currentRound) {
    return <div>Error: No current round</div>;
  }

  const leaderboard = Array.from(game.leaderboard.scores.values())
    .sort((a, b) => b.totalScore - a.totalScore);

  const isGameOver = game.status === 'game_end';

  // Helper function to get leaderboard item background style
  const getLeaderboardItemStyle = (index: number): string => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-600 to-yellow-500';
    if (index === 1) return 'bg-gradient-to-r from-gray-500 to-gray-400';
    if (index === 2) return 'bg-gradient-to-r from-orange-700 to-orange-600';
    return 'bg-gray-700';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          {isGameOver ? '🎉 Game Over!' : `Round ${currentRound.roundNumber} Complete!`}
        </h2>
        <p className="text-gray-400">
          {isGameOver ? 'Final Results' : 'Here\'s how you did this round'}
        </p>
      </div>

      {/* Round Scores */}
      {!isGameOver && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-white mb-4">Round {currentRound.roundNumber} Scores</h3>
          <div className="space-y-2">
            {Array.from(currentRound.scores.entries())
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, score]) => {
                const player = room.players.get(playerId);
                return (
                  <div
                    key={playerId}
                    className="flex justify-between items-center bg-gray-700 rounded-lg px-4 py-3"
                  >
                    <span className="text-white font-medium">
                      {player?.displayName || 'Unknown'}
                    </span>
                    <span className="text-green-400 font-bold">+{score} pts</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          {isGameOver ? '🏆 Final Leaderboard' : 'Leaderboard'}
        </h3>
        <div className="space-y-3">
          {leaderboard.map((playerScore, index) => {
            const player = room.players.get(playerScore.playerId);
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[index] || '';
            
            return (
              <div
                key={playerScore.playerId}
                className={`flex items-center justify-between rounded-lg px-6 py-4 ${getLeaderboardItemStyle(index)}`}
              >
                <div className="flex items-center space-x-4">
                  <span className="text-2xl font-bold text-white w-8">
                    {medal || `${index + 1}.`}
                  </span>
                  <div>
                    <p className="text-white font-semibold text-lg">
                      {player?.displayName || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-300">
                      {playerScore.roundScores.join(', ')} pts per round
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-white">
                  {playerScore.totalScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Continue Button */}
      <div className="text-center">
        {isGameOver ? (
          <p className="text-gray-400">Thanks for playing!</p>
        ) : (
          <div className="space-y-4">
            {isHost && game.status === 'round_end' && (
              <button
                onClick={onNextRound}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-colors"
              >
                Start Round {game.currentRound + 1}
              </button>
            )}
            {!isHost && (
              <p className="text-gray-400">Waiting for host to start next round...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
