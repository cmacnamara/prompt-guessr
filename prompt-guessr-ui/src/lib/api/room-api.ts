import { Room } from '@/shared/types';

/**
 * API URL for the backend server.
 * Can be configured via environment variable.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Response from room creation endpoint.
 */
export interface CreateRoomResponse {
  roomId: string;
  roomCode: string;
  playerId: string;
}

/**
 * Response from room join endpoint.
 */
export interface JoinRoomResponse {
  roomId: string;
  roomCode: string;
  playerId: string;
}

/**
 * Response from get room endpoint.
 */
export interface GetRoomResponse {
  room: Room;
}

/**
 * Create a new room.
 * 
 * @param playerName - Display name for the player creating the room
 * @param settings - Optional room settings
 * @returns Room data including room code and player ID
 * @throws Error if the request fails
 */
export async function createRoom(
  playerName: string,
  settings?: Record<string, any>
): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_URL}/api/rooms/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerName,
      settings,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create room');
  }

  return response.json();
}

/**
 * Join an existing room.
 * 
 * @param roomCode - The room code to join
 * @param playerName - Display name for the joining player
 * @returns Room data including room code and player ID
 * @throws Error if the request fails
 */
export async function joinRoom(
  roomCode: string,
  playerName: string
): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomCode: roomCode.toUpperCase(),
      playerName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join room');
  }

  return response.json();
}

/**
 * Get room by code.
 * 
 * @param roomCode - The room code to fetch
 * @returns Room data
 * @throws Error if the request fails
 */
export async function getRoomByCode(
  roomCode: string
): Promise<GetRoomResponse> {
  const response = await fetch(`${API_URL}/api/rooms/${roomCode.toUpperCase()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch room');
  }

  return response.json();
}
