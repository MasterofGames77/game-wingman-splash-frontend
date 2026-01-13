import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'videogamewingman.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone', // Useful for deploying to Docker or Vercel
  // Explicitly set workspace root to silence lockfile warning
  // This is needed when there are multiple package-lock.json files in parent directories
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
 