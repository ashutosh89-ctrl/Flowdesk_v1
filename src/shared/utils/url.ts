/**
 * FlowDesk Application URL Utilities
 * 
 * Provides environment-aware canonical base URLs for SEO, sitemaps, robots,
 * metadataBase, and OpenGraph link previews.
 */

export function getAppBaseUrl(): string {
  // 1. Explicit production or custom environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
  }
  
  if (process.env.APP_URL) {
    return cleanUrl(process.env.APP_URL);
  }

  // 2. Vercel deployment automatic URL
  if (process.env.VERCEL_URL) {
    return `https://${cleanUrl(process.env.VERCEL_URL)}`;
  }

  // 3. Localhost fallback for development and testing
  return 'http://localhost:3000';
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
