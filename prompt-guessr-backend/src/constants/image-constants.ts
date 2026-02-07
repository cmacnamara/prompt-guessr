/**
 * Centralized constants and enums for image generation
 */

export enum ImageProviderType {
  MOCK = 'mock',
  OPENAI = 'openai',
  HUGGINGFACE = 'huggingface',
}

export enum OpenAIModel {
  DALLE_2 = 'dall-e-2',
  DALLE_3 = 'dall-e-3',
}

export enum OpenAIImageSize {
  SMALL = '256x256',
  MEDIUM = '512x512',
  LARGE = '1024x1024',
}
