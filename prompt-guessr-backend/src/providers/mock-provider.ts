import { v4 as uuid } from 'uuid';
import type { GeneratedImage } from '../../shared/types/prompt.js';
import type { ImageProvider } from './image-provider.interface.js';

/**
 * Mock image provider for development
 * Returns placeholder images instantly without calling external APIs
 */
export class MockImageProvider implements ImageProvider {
  async generateImages(
    prompt: string,
    count: number,
    playerId: string
  ): Promise<GeneratedImage[]> {
    // Simulate a small delay (0.5-1.5 seconds) to make it feel realistic
    const delay = 500 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Use specific picsum.photos IDs so images are consistent
    // Picsum has IDs from 0-1084, we'll use a subset to avoid NSFW content
    const safeImageIds = [1, 10, 20, 28, 40, 48, 63, 82, 103, 119, 134, 152, 169, 180, 200, 241, 250, 287, 292, 306, 316, 323, 342, 365, 390, 403, 429, 447, 474, 493];
    
    return Array.from({ length: count }, (_, i) => {
      // Generate a consistent but varied image ID based on prompt and index
      const promptHash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const imageIdIndex = (promptHash + i) % safeImageIds.length;
      const imageId = safeImageIds[imageIdIndex];
      
      return {
        id: uuid(),
        promptId: '', // Will be set by caller
        playerId,
        imageUrl: `https://picsum.photos/id/${imageId}/512/512`,
        thumbnailUrl: `https://picsum.photos/id/${imageId}/256/256`,
        provider: 'mock' as const,
        providerImageId: `mock-${uuid()}`,
        status: 'complete' as const,
        generatedAt: Date.now(),
        metadata: {
          model: 'mock-generator-v1',
          generationTime: delay,
        },
      };
    });
  }

  getProviderName(): string {
    return 'mock';
  }
}
