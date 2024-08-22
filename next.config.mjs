/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vgw-splash-page-frontend-71431835113b.herokuapp.com',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone', // Useful for deploying to Docker or Vercel
};

export default nextConfig;
 