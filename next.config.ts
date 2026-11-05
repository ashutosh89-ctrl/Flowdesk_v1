import type { NextConfig } from 'next';
import path from 'path';

import { getSecurityHeaders } from './src/shared/config/security-headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Lint is part of the release gate — builds must fail on lint errors.
    ignoreDuringBuilds: false,
  },
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ['razorpay'],
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeaders(),
      },
      {
        source: '/connect/:path*',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/deliverables',
        destination: '/dashboard?view=deliverables',
        permanent: false,
      },
      {
        source: '/invoices',
        destination: '/dashboard?view=invoices',
        permanent: false,
      },
      {
        source: '/projects',
        destination: '/dashboard?view=projects',
        permanent: false,
      },
      {
        source: '/clients',
        destination: '/dashboard?view=clients',
        permanent: false,
      },
      {
        source: '/documents',
        destination: '/dashboard?view=documents',
        permanent: false,
      },
      {
        source: '/settings',
        destination: '/dashboard?view=settings',
        permanent: false,
      },
      {
        source: '/freelancer/settings',
        destination: '/dashboard?view=settings',
        permanent: false,
      },
      {
        source: '/freelancer/:path*',
        destination: '/dashboard?view=:path*',
        permanent: false,
      },
      {
        source: '/refund',
        destination: '/refund-policy',
        permanent: true,
      },
      {
        source: '/refunds',
        destination: '/refund-policy',
        permanent: true,
      },
      {
        source: '/cancellation',
        destination: '/cancellation-policy',
        permanent: true,
      },
      {
        source: '/cancellations',
        destination: '/cancellation-policy',
        permanent: true,
      },
      {
        source: '/terms-of-service',
        destination: '/terms',
        permanent: true,
      },
      {
        source: '/privacy-policy',
        destination: '/privacy',
        permanent: true,
      },
    ];
  },

  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;