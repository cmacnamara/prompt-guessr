'use client';

import { Room } from '@/shared/types/room';
import { Player } from '@/shared/types/player';

interface LobbyProps {
  room: Room;
  roomCode: string;
  currentPlayer: Player;
  isHost: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
}

/**
 * Lobby component displayed before game starts.
 * Shows player list, ready status, and game start controls.
 */
export default function Lobby({
  room,
  roomCode,
  currentPlayer,
  isHost,
  onToggleReady,
  onStartGame,
}: LobbyProps) {
  const players = Array.from(room.players.values());
  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);
  const canStartGame = players.length >= 2 && allPlayersReady;

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Lobby
      </h2>
    
      <p className="text-gray-800 mb-6">
        Share the room code <span className="font-bold text-purple-600">{roomCode}</span> with your friends!
      </p>

      {/* Player List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Players ({players.length}/{room.maxPlayers})
        </h3>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                player.isConnected ? 'bg-gray-50' : 'bg-gray-100 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="font-medium text-gray-800">
                  {player.displayName}
                  {player.isHost && (
                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      Host
                    </span>
                  )}
                </span>
              </div>
              <div>
                {player.isReady ? (
                  <span className="text-green-600 font-semibold">✓ Ready</span>
                ) : (
                  <span className="text-gray-600 font-medium">Not Ready</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onToggleReady}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
            currentPlayer.isReady
              ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {currentPlayer.isReady ? 'Not Ready' : 'Ready Up'}
        </button>
        
        {isHost && (
          <button
            onClick={onStartGame}
            disabled={!canStartGame}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
              canStartGame
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            Start Game
          </button>
        )}
      </div>

      {/* Status messages for all players */}
      {players.length < 2 && (
        <p className="text-sm text-gray-700 font-medium mt-3 text-center">
          Waiting for more players to join...
        </p>
      )}
      {players.length >= 2 && !allPlayersReady && (
        <p className="text-sm text-gray-700 font-medium mt-3 text-center">
          Waiting for all players to be ready...
        </p>
      )}
      {players.length >= 2 && allPlayersReady && (
        <p className="text-sm text-gray-700 font-medium mt-3 text-center">
          {isHost ? 'Waiting for you to start game...' : 'Waiting for host to start game...'}
        </p>
      )}
    </div>
  );
}
