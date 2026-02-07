import type { GeneratedImage } from '../../shared/types/prompt.js';

/**
 * Interface for image generation providers
 * Allows swapping between mock, DALL-E, Stable Diffusion, etc.
 */
export interface ImageProvider {
  generateImages(prompt: string, count: number, playerId: string): Promise<GeneratedImage[]>;
  getProviderName(): string;
}
