import { v4 as uuid } from 'uuid';
import OpenAI from 'openai';
import type { GeneratedImage } from '../../shared/types/prompt.js';
import type { ImageProvider } from './image-provider.interface.js';
import { OpenAIModel, OpenAIImageSize } from '../constants/image-constants.js';
import { logger } from '../utils/logger.js';

/**
 * OpenAI DALL-E provider
 * Uses DALL-E 2 for reliable image generation
 */
export class OpenAIProvider implements ImageProvider {
  private readonly client: OpenAI;
  private readonly model: OpenAIModel;
  private readonly size: OpenAIImageSize;

  constructor(
    apiKey?: string,
    model: OpenAIModel = OpenAIModel.DALLE_2,
    size: OpenAIImageSize = OpenAIImageSize.MEDIUM
  ) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
    this.size = size;
  }

  async generateImages(
    prompt: string,
    count: number,
    playerId: string
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    
    try {
      // DALL-E 3 only supports n=1, DALL-E 2 supports up to n=10
      const maxBatchSize = this.model === OpenAIModel.DALLE_3 ? 1 : count;
      
      const images: GeneratedImage[] = [];
      
      if (this.model === OpenAIModel.DALLE_3 && count > 1) {
        // Generate sequentially for DALL-E 3
        for (let i = 0; i < count; i++) {
          const result = await this.generateBatch(prompt, 1, playerId, startTime);
          images.push(...result);
        }
      } else {
        // Generate in one batch for DALL-E 2
        const result = await this.generateBatch(prompt, maxBatchSize, playerId, startTime);
        images.push(...result);
      }
      
      return images;
    } catch (error) {
      logger.error('OpenAI generation failed:', error);
      throw error;
    }
  }

  private async generateBatch(
    prompt: string,
    n: number,
    playerId: string,
    startTime: number
  ): Promise<GeneratedImage[]> {
    const response = await this.client.images.generate({
      model: this.model,
      prompt,
      n,
      size: this.size,
      response_format: 'url',
    });

    if (!response.data) {
      throw new Error('OpenAI API returned no image data');
    }

    return response.data.map((image): GeneratedImage => ({
      id: uuid(),
      promptId: '',
      playerId,
      imageUrl: image.url!,
      thumbnailUrl: image.url!, // Same for now, could resize later
      provider: 'openai',
      providerImageId: `openai-${uuid()}`,
      status: 'complete' as const,
      generatedAt: Date.now(),
      metadata: {
        model: this.model,
        generationTime: Date.now() - startTime,
        revisedPrompt: (image as any).revised_prompt,
      },
    }));
  }

  getProviderName(): string {
    return 'openai';
  }
}
