/**
 * FlowDesk Application URL Utilities
 * 
 * Provides environment-aware canonical base URLs for SEO, sitemaps, robots,
 * metadataBase, and OpenGraph link previews.
 */

export function getAppBaseUrl(): string {
  // 1. Browser runtime: use current origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return cleanUrl(window.location.origin);
  }

  // 2. Explicit configured application URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return formatUrl(process.env.NEXT_PUBLIC_APP_URL);
  }
  
  if (process.env.APP_URL) {
    return formatUrl(process.env.APP_URL);
  }

  // 3. Vercel deployment system environment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return formatUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return formatUrl(process.env.NEXT_PUBLIC_VERCEL_URL);
  }

  if (process.env.VERCEL_URL) {
    return formatUrl(process.env.VERCEL_URL);
  }

  // 4. Default fallback for local development
  return 'http://localhost:3000';
}

function formatUrl(url: string): string {
  const cleaned = cleanUrl(url);
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  return `https://${cleaned}`;
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

