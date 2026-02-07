import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO server URL from environment or default to localhost.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

/**
 * Singleton socket instance.
 */
let socket: Socket | null = null;

/**
 * Get the Socket.IO client instance.
 * Creates a new socket if one doesn't exist.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection event logging
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  return socket;
}

/**
 * Connect to the Socket.IO server with authentication.
 * 
 * @param roomId - The room ID to join
 * @param playerId - The player's unique ID
 */
export function connectSocket(roomId: string, playerId: string): void {
  const socket = getSocket();
  
  // Set auth data for the connection
  socket.auth = { roomId, playerId };
  
  // Connect if not already connected
  if (!socket.connected) {
    socket.connect();
  }
}

/**
 * Disconnect from the Socket.IO server.
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Check if socket is currently connected.
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
