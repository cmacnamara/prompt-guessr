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
 * Get CORS origins from environment
 * Supports comma-separated list for multiple domains
 */
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || 'http://localhost:3000';
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(',').map(origin => origin.trim());

// Validate CORS_ORIGIN in production
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.error('CORS_ORIGIN environment variable is required in production');
  process.exit(1);
}

logger.info(`CORS enabled for origins: ${CORS_ORIGINS.join(', ')}`);

/**
 * CORS origin checker - allows single origin or comma-separated list
 */
const checkOrigin = (origin: string | undefined): string | boolean => {
  // Allow requests with no origin (like mobile apps or Postman)
  if (!origin) return true;
  
  // Check if origin is in allowed list
  if (CORS_ORIGINS.includes(origin)) {
    return origin;
  }
  
  // Deny if not in allowed list
  return false;
};

/**
 * Configure Socket.IO with CORS
 */
const io = new Server(httpServer, {
  cors: {
    origin: '*', // TEMPORARY: Allow all origins
    methods: ['GET', 'POST'],
    credentials: false,
  },
});

/**
 * Express middleware
 */
app.use(express.json());

// CORS for REST endpoints (skip Socket.IO paths)
app.use((req, res, next) => {
  // Let Socket.IO handle its own CORS
  if (req.path.startsWith('/socket.io/')) {
    return next();
  }
  
  // TEMPORARY: Allow all origins (matching Socket.IO config above)
  // TODO: Set CORS_ORIGIN environment variable to lock down to specific domains
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
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
    logger.error('Health check error:', error);
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
    logger.error('Ready check error:', error);
    res.status(503).json({ ready: false, reason: 'not_initialized' });
  }
});

/**
 * Debug endpoint - shows current CORS configuration
 */
app.get('/debug/cors', (req, res) => {
  res.json({
    corsOrigins: CORS_ORIGINS,
    corsOriginRaw: CORS_ORIGIN_RAW,
    nodeEnv: process.env.NODE_ENV,
  });
});

/**
 * Mount API routes
 */
app.use('/api/rooms', roomRoutes);

/**
 * Socket.IO connection handling
 */
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  const transport = socket.conn.transport.name;
  logger.info(`Socket connected: ${socket.id} from ${clientIp} via ${transport}`);

  // Register room event handlers
  registerRoomHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
});

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('Shutting down server...');
  
  // Set a timeout to force exit if shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout
  
  try {
    // Close Socket.IO connections first (wrap in promise to await)
    await new Promise<void>((resolve) => {
      io.close(() => {
        logger.info('Socket.IO closed');
        resolve();
      });
    });

    // Close Redis connection
    await closeRedis();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
    
    logger.info('Graceful shutdown complete');
    clearTimeout(forceExitTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Start server
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    // Initialize Redis
    await initRedis();

    // Initialize image generation service (reads from env vars)
    initializeImageService();
    logger.info('✨ Image service initialized');

    // Start HTTP server
    const PORT = parseInt(process.env.PORT || '3001', 10);
    const HOST = '0.0.0.0'; // Listen on all interfaces (needed for ALB)
    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`🔌 Socket.IO ready for connections`);
      
      // Signal PM2 that app is ready (only in production with PM2)
      if (process.send) {
        process.send('ready');
        logger.info('📡 Sent ready signal to PM2');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Export io for use in socket handlers
export { io };
