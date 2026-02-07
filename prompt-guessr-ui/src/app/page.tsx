'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as roomApi from '@/lib/api/room-api';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const data = await roomApi.createRoom(playerName.trim());
      
      // Store player ID in localStorage
      localStorage.setItem('playerId', data.playerId);
      
      // Navigate to room page
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const data = await roomApi.joinRoom(roomCode.trim(), playerName.trim());
      
      // Store player ID in localStorage
      localStorage.setItem('playerId', data.playerId);
      
      // Navigate to room page
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          Prompt Guessr
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Guess the AI image prompts with friends!
        </p>

        {/* Player Name Input */}
        <div className="mb-6">
          <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name
          </label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            maxLength={20}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Create Room Button */}
        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6"
        >
          {isCreating ? 'Creating...' : 'Create New Room'}
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or join a room</span>
          </div>
        </div>

        {/* Join Room Form */}
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <div>
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase"
              maxLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={isJoining}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </main>
  );
}
