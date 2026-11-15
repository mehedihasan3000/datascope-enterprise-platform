import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@datascope/shared'],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async rewrites() {
    const rawInternalApi = process.env.INTERNAL_API_URL?.trim();
    if (!rawInternalApi || !/^https?:\/\//i.test(rawInternalApi)) {
      return [];
    }

    const normalized = rawInternalApi.replace(/\/+$/, '');
    const apiBase = normalized.endsWith('/api/v1')
      ? normalized
      : `${normalized}/api/v1`;

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
