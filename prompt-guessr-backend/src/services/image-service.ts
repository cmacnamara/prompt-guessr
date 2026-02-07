import type { GeneratedImage } from '../../shared/types/prompt.js';
import type { ImageProvider } from '../providers/image-provider.interface.js';
import { MockImageProvider } from '../providers/mock-provider.js';
import { HuggingFaceProvider } from '../providers/huggingface-provider.js';
import { OpenAIProvider } from '../providers/openai-provider.js';
import { ImageProviderType } from '../constants/image-constants.js';
import { logger } from '../utils/logger.js';

// Re-export types and classes for convenience
export type { ImageProvider } from '../providers/image-provider.interface.js';
export { MockImageProvider } from '../providers/mock-provider.js';
export { HuggingFaceProvider } from '../providers/huggingface-provider.js';
export { OpenAIProvider } from '../providers/openai-provider.js';
export { ImageProviderType, OpenAIModel, OpenAIImageSize } from '../constants/image-constants.js';

/**
 * Image service configuration from environment variables
 */
interface ImageServiceConfig {
  provider: ImageProviderType;
  enableFallback: boolean;
  fallbackProvider?: ImageProviderType.OPENAI | ImageProviderType.HUGGINGFACE;
}

/**
 * Get image service configuration from environment variables
 */
function getConfig(): ImageServiceConfig {
  const provider = (process.env.IMAGE_PROVIDER || ImageProviderType.MOCK).toLowerCase() as ImageProviderType;
  const enableFallback = process.env.ENABLE_FALLBACK === 'true';
  const fallbackProvider = process.env.FALLBACK_PROVIDER?.toLowerCase() as ImageServiceConfig['fallbackProvider'];

  return {
    provider,
    enableFallback,
    fallbackProvider,
  };
}

/**
 * Create a provider instance by name
 */
function createProvider(providerName: string): ImageProvider {
  switch (providerName.toLowerCase()) {
    case ImageProviderType.OPENAI:
      return new OpenAIProvider();
    case ImageProviderType.HUGGINGFACE:
      return new HuggingFaceProvider();
    case ImageProviderType.MOCK:
    default:
      return new MockImageProvider();
  }
}

/**
 * Singleton instances of providers (lazy-loaded)
 */
let mainProvider: ImageProvider | null = null;
let fallbackProviderInstance: ImageProvider | null = null;

/**
 * Initialize the image service with configuration
 * Call this at application startup
 */
export function initializeImageService(): void {
  const config = getConfig();
  
  logger.info(`Initializing image service with provider: ${config.provider}`);
  mainProvider = createProvider(config.provider);
  
  if (config.enableFallback && config.fallbackProvider) {
    logger.info(`Fallback enabled: ${config.fallbackProvider}`);
    fallbackProviderInstance = createProvider(config.fallbackProvider);
  } else {
    fallbackProviderInstance = null;
  }
}

/**
 * Get the main provider (initializes if needed)
 */
export function getImageProvider(): ImageProvider {
  if (!mainProvider) {
    initializeImageService();
  }
  return mainProvider!;
}

/**
 * Set a custom provider (for testing)
 */
export function setImageProvider(provider: ImageProvider): void {
  mainProvider = provider;
}

/**
 * Generate images for a prompt
 * Uses the configured provider with optional fallback
 */
/**
 * Custom error for content policy violations
 */
export class ContentPolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentPolicyViolationError';
  }
}

export async function generateImages(
  prompt: string,
  count: number,
  playerId: string
): Promise<GeneratedImage[]> {
  if (!mainProvider) {
    initializeImageService();
  }

  // Try main provider
  try {
    logger.info(`Generating images with ${mainProvider!.getProviderName()}`);
    const images = await mainProvider!.generateImages(prompt, count, playerId);
    logger.info(`Successfully generated ${images.length} images with ${mainProvider!.getProviderName()}`);
    return images;
  } catch (error: any) {
    // Check if this is a content policy violation
    const isContentViolation = error?.code === 'content_policy_violation' || 
                               error?.type === 'image_generation_user_error';
    
    if (isContentViolation) {
      logger.warn(`Content policy violation detected for prompt from player ${playerId}`);
      throw new ContentPolicyViolationError(
        error?.error?.message || 'Content policy violation'
      );
    }

    logger.warn(`Main provider ${mainProvider!.getProviderName()} failed:`, error);

    // Try fallback if enabled
    if (fallbackProviderInstance) {
      try {
        logger.info(`Attempting fallback to ${fallbackProviderInstance.getProviderName()}`);
        const images = await fallbackProviderInstance.generateImages(prompt, count, playerId);
        logger.info(`Successfully generated ${images.length} images with fallback provider`);
        return images;
      } catch (fallbackError: any) {
        // Check content violation on fallback too
        const isFallbackContentViolation = fallbackError?.code === 'content_policy_violation' || 
                                           fallbackError?.type === 'image_generation_user_error';
        
        if (isFallbackContentViolation) {
          throw new ContentPolicyViolationError(
            fallbackError?.error?.message || 'Content policy violation'
          );
        }

        logger.error(`Fallback provider ${fallbackProviderInstance.getProviderName()} also failed:`, fallbackError);
        throw new Error(
          `Both main and fallback providers failed. Last error: ${(fallbackError as Error).message}`
        );
      }
    }

    // No fallback configured, re-throw original error
    throw error;
  }
}
