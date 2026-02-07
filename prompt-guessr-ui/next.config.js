/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Allow images from external domains (for AI-generated images)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Transpile shared types from our monorepo
  transpilePackages: ['shared'],
};

module.exports = nextConfig;
