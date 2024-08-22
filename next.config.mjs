/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
      domains: ['vgw-splash-page-frontend-71431835113b.herokuapp.com'],
    },
    output: 'standalone',
  };
  
  export default nextConfig;  