import { createClient, RedisClientType } from 'redis';

/**
 * Singleton Redis client instance.
 * Shared across the entire server application.
 */
let redisClient: RedisClientType | null = null;

/**
 * Initialize and connect to Redis.
 * Should be called once on server startup.
 */
export async function initRedis(): Promise<void> {
  if (redisClient) {
    console.log('Redis client already initialized');
    return;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
  });

  // Error handling
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis client connected');
  });

  redisClient.on('ready', () => {
    console.log('Redis client ready');
  });

  // Connect to Redis
  try {
    await redisClient.connect();
    console.log(`✅ Redis connected to ${redisUrl}`);
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Get the Redis client instance.
 * Throws error if not initialized.
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Close the Redis connection.
 * Should be called on server shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
}
