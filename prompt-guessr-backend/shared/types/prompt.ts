/**
 * Status of a prompt submission as it goes through the image generation process.
 */
export type PromptSubmissionStatus = 'pending' | 'generating' | 'ready' | 'failed' | 'rejected';

/**
 * Status of an individual generated image.
 */
export type GeneratedImageStatus = 'queued' | 'generating' | 'complete' | 'failed';

/**
 * Image generation provider type.
 */
export type ImageProvider = 'mock' | 'dalle3' | 'stable-diffusion' | 'huggingface' | 'openai';

/**
 * Metadata specific to the image generation provider.
 */
export interface ImageMetadata {
  /** AI model used (e.g., "dall-e-3", "stable-diffusion-xl") */
  model?: string;
  
  /** Some providers (like DALL-E) may revise the prompt for safety/clarity */
  revisedPrompt?: string;
  
  /** Time taken to generate in milliseconds */
  generationTime?: number;
}

/**
 * Represents a single generated image.
 */
export interface GeneratedImage {
  /** Unique identifier for the image (UUID) */
  id: string;
  
  /** ID of the prompt submission this image belongs to */
  promptId: string;
  
  /** ID of the player who owns this image */
  playerId: string;
  
  /** URL to the full-size image (null until generated) */
  imageUrl?: string;
  
  /** URL to an optimized thumbnail (optional) */
  thumbnailUrl?: string;
  
  /** Which provider generated this image */
  provider: ImageProvider;
  
  /** Provider's ID for this image (for tracking/debugging) */
  providerImageId?: string;
  
  /** Current status of this image */
  status: GeneratedImageStatus;
  
  /** Timestamp when image was generated */
  generatedAt?: number;
  
  /** Provider-specific metadata */
  metadata?: ImageMetadata;
}

/**
 * Represents a player's prompt submission and its generated images.
 */
export interface PromptSubmission {
  /** ID of the player who submitted this prompt */
  playerId: string;
  
  /** The text prompt submitted by the player */
  prompt: string;
  
  /** Timestamp when prompt was submitted */
  submittedAt: number;
  
  /** Array of images generated from this prompt (typically 4) */
  images: GeneratedImage[];
  
  /** Overall status of this submission */
  status: PromptSubmissionStatus;
}
