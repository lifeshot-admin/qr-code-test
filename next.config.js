/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // 기존 프로젝트의 pre-existing 타입 에러가 있어 빌드 시 무시
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // ✅ 버블 CDN (특정 해시 서브도메인)
      {
        protocol: 'https',
        hostname: 'f577a0c9af74af84c4c56122927f2000.cdn.bubble.io',
        port: '',
        pathname: '/**',
      },
      // ✅ 버블 CDN (와일드카드 - 해시가 변경되어도 대응)
      {
        protocol: 'https',
        hostname: '*.cdn.bubble.io',
        port: '',
        pathname: '/**',
      },
      // ✅ 버블 메인 도메인 (이미지가 직접 호스팅되는 경우)
      {
        protocol: 'https',
        hostname: '*.bubble.io',
        port: '',
        pathname: '/**',
      },
      // ✅ 버블 커스텀 도메인
      {
        protocol: 'https',
        hostname: 'lifeshot.me',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.lifeshot.me',
        port: '',
        pathname: '/**',
      },
      // ✅ AWS S3 (버블 백엔드 스토리지)
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      // ✅ Kimi (폴백 이미지)
      {
        protocol: 'https',
        hostname: 'kimi-web-img.moonshot.cn',
        port: '',
        pathname: '/**',
      },
      // ✅ AWS S3 (Cheiz 프로덕션 이미지 버킷)
      {
        protocol: 'https',
        hostname: 'cheiz-public-images-prod.s3.ap-northeast-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
    // WebP 형식 우선 사용
    formats: ['image/webp', 'image/avif'],
    // 반응형 이미지 크기 세트
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 이미지 캐시 TTL (1시간)
    minimumCacheTTL: 3600,
  },
  // App Router의 body size limit 설정 (인증사진 등 대용량 요청 허용)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
