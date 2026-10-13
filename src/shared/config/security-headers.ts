/**
 * FlowDesk Central Security Headers Configuration
 * 
 * Enforces production defense-in-depth:
 * - HSTS (2 years, includeSubDomains; preload omitted pending subdomain audit)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY & frame-ancestors 'none'
 * - Referrer-Policy: strict-origin-when-cross-origin (no-referrer on /connect/*)
 * - Permissions-Policy: strictly denying camera, microphone, geolocation, usb, etc.
 * - Content-Security-Policy in Report-Only mode by default (switched via CSP_MODE=enforce)
 */

export interface SecurityHeaderItem {
  key: string;
  value: string;
}

export function buildContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    // NOTE: 'unsafe-inline' and 'unsafe-eval' retained for Next.js App Router client chunks and dev overlays.
    // TODO [PHASE 5]: Migrate to cryptographic nonces via Edge Middleware once Next static page prerendering permits.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://picsum.photos https://images.unsplash.com https://*.supabase.co https://*.razorpay.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ];

  return directives.join('; ');
}

export function getSecurityHeaders(): SecurityHeaderItem[] {
  const isEnforce = process.env.CSP_MODE?.trim().toLowerCase() === 'enforce';
  const cspHeaderName = isEnforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

  return [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(), accelerometer=(), gyroscope=()',
    },
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on',
    },
    {
      key: cspHeaderName,
      value: buildContentSecurityPolicy(),
    },
  ];
}
