/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'f577a0c9af74af84c4c56122927f2000.cdn.bubble.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.lifeshot.me',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // App Router의 body size limit 설정 (인증사진 등 대용량 요청 허용)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
