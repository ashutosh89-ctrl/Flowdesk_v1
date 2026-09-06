import type { MetadataRoute } from 'next';
import { getAppBaseUrl } from '@/shared/utils/url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/dashboard',
          '/dashboard/*',
          '/portal',
          '/portal/*',
          '/client',
          '/client/*',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/recover',
          '/onboarding',
          '/auth',
          '/auth/*',
          '/api',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
