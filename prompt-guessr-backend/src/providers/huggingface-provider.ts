import { v4 as uuid } from 'uuid';
import { InferenceClient } from '@huggingface/inference';
import type { GeneratedImage } from '../../shared/types/prompt.js';
import type { ImageProvider } from './image-provider.interface.js';
import { logger } from '../utils/logger.js';

/**
 * Hugging Face Inference API provider
 * Uses Stable Diffusion XL for free (rate-limited) image generation
 */
export class HuggingFaceProvider implements ImageProvider {
  private readonly client: InferenceClient;
  private readonly model: string;

  constructor(apiKey?: string, model = 'stabilityai/stable-diffusion-xl-base-1.0') {
    const apiKeyFinal = apiKey || process.env.HUGGINGFACE_API_KEY || '';
    
    if (!apiKeyFinal) {
      logger.warn('HuggingFaceProvider initialized without API key - will likely fail');
    }
    
    this.client = new InferenceClient(apiKeyFinal);
    this.model = model;
  }

  async generateImages(
    prompt: string,
    count: number,
    playerId: string
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const images: GeneratedImage[] = [];

    try {
      // Generate images in parallel
      const promises = Array.from({ length: count }, () =>
        this.generateSingleImage(prompt, playerId, startTime)
      );
      
      const results = await Promise.all(promises);
      images.push(...results.filter(Boolean) as GeneratedImage[]);
      
      if (images.length === 0) {
        throw new Error('No images generated successfully');
      }
      
      return images;
    } catch (error) {
      logger.error('HuggingFace generation failed:', error);
      throw error;
    }
  }

  private async generateSingleImage(
    prompt: string,
    playerId: string,
    startTime: number
  ): Promise<GeneratedImage | null> {
    try {
      // Use the official Hugging Face client for text-to-image generation
      const imageUrl = await this.client.textToImage({
        model: this.model,
        inputs: prompt,
        parameters: {
          num_inference_steps: 20,
          guidance_scale: 7.5,
          negative_prompt: "blurry, low quality, distorted",
        },
      });

      return {
        id: uuid(),
        promptId: '',
        playerId,
        imageUrl,
        thumbnailUrl: imageUrl, // Same for now
        provider: 'huggingface',
        providerImageId: `hf-${uuid()}`,
        status: 'complete',
        generatedAt: Date.now(),
        metadata: {
          model: this.model,
          generationTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      logger.error('HuggingFace single image generation failed:', error);
      return null;
    }
  }

  getProviderName(): string {
    return 'huggingface';
  }
}
