/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimized production builds with standalone output
  output: 'standalone',
  
  // Allow images from specific AI provider domains (security best practice)
  images: {
    remotePatterns: [
      // HuggingFace Inference API
      {
        protocol: 'https',
        hostname: '*.huggingface.co',
      },
      // OpenAI DALL-E
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      // AWS S3 (for production image storage)
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      // For development/testing
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  
  // Transpile shared types from our monorepo
  transpilePackages: ['shared'],
  
  // Environment variable validation
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
};

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SOCKET_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }
}

module.exports = nextConfig;
