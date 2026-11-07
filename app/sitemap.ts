import type { MetadataRoute } from 'next';
import { getAppBaseUrl } from '@/shared/utils/url';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppBaseUrl();
  const currentDate = new Date();

  const publicRoutes = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/contact', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/refund-policy', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/cancellation-policy', priority: 0.6, changeFrequency: 'monthly' as const },
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: currentDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
