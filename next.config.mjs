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
    ],
  },
  output: 'standalone', // Useful for deploying to Docker or Vercel
};

export default nextConfig;
 