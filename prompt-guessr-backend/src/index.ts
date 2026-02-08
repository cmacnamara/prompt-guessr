import 'dotenv/config';  // Load environment variables from .env file
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { initRedis, closeRedis, getRedisClient } from './storage/redis-client';
import { initializeImageService } from './services/image-service';
import { logger } from './utils/logger';
import roomRoutes from './routes/room-routes';
import { registerRoomHandlers } from './socket/room-handlers';

/**
 * Initialize Express app
 */
const app = express();
const httpServer = createServer(app);

/**
 * Get CORS origin from environment
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Validate CORS_ORIGIN in production
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.error('CORS_ORIGIN environment variable is required in production');
  process.exit(1);
}

/**
 * Configure Socket.IO with CORS
 */
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

/**
 * Express middleware
 */
app.use(express.json());

// CORS for REST endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

/**
 * Health check endpoint - includes Redis connectivity status
 */
app.get('/health', (req, res) => {
  try {
    const redisClient = getRedisClient();
    const redisStatus = redisClient.isReady ? 'connected' : 'disconnected';
    
    if (!redisClient.isReady) {
      return res.status(503).json({ 
        status: 'degraded', 
        redis: redisStatus,
        timestamp: new Date().toISOString() 
      });
    }
    
    res.json({ 
      status: 'ok', 
      redis: redisStatus,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      redis: 'not_initialized',
      timestamp: new Date().toISOString() 
    });
  }
});

/**
 * Ready check endpoint - only returns 200 when fully initialized
 */
app.get('/ready', (req, res) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient.isReady) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'redis_not_ready' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'not_initialized' });
  }
});

/**
 * Mount API routes
 */
app.use('/api/rooms', roomRoutes);

/**
 * Socket.IO connection handling
 */
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Register room event handlers
  registerRoomHandlers(io, socket);

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('Shutting down server...');
  
  // Close Socket.IO connections
  io.close(() => {
    logger.info('Socket.IO closed');
  });

  // Close Redis connection
  await closeRedis();

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Start server
 */
(async () => {
  try {
    // Initialize Redis
    await initRedis();

    // Initialize image generation service (reads from env vars)
    initializeImageService();
    logger.info('✨ Image service initialized');

    // Start HTTP server
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`🔌 Socket.IO ready for connections`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Export io for use in socket handlers
export { io };
