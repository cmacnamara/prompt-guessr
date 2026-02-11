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
      reconnectionDelayMax: 5000,
      // Transport configuration - prefer WebSocket, fallback to polling
      transports: ['websocket', 'polling'],
      upgrade: true, // Allow upgrading from polling to websocket
      // Timeouts
      timeout: 20000, // Connection timeout (20s)
      // Enable logging in development
      ...(process.env.NODE_ENV === 'development' && {
        
      }),
    });

    // Connection event logging
    socket.on('connect', () => {
      if (!socket) return;
      console.log('✅ Socket connected:', socket.id, 'Transport:', socket.io.engine.transport.name);
      
      // Log transport upgrades (set up after connection)
      socket.io.engine.on('upgrade', (transport: any) => {
        console.log('⬆️ Transport upgraded to:', transport.name);
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      console.error('Socket URL:', SOCKET_URL);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - max attempts reached');
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
