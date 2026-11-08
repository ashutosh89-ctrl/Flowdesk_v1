import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { isSafeHttpUrl } from '@/shared/utils/safe-url';

export const runtime = 'nodejs';

const ALLOWED_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'picsum.photos',
  'images.unsplash.com',
  'razorpay.com',
];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

/**
 * Image proxy endpoint to fetch remote assets (Supabase public storage, avatars, logos)
 * server-side and stream them with open CORS headers to prevent canvas tainting in html2canvas.
 * Hardened with domain allowlist, private IP checks, and rate limiting (SSRF protection).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'image_proxy',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url')?.trim();

  if (!imageUrl || !isSafeHttpUrl(imageUrl)) {
    return NextResponse.json({ error: 'Missing or invalid image url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private, loopback, and metadata addresses
  if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return NextResponse.json({ error: 'Access to target address is forbidden' }, { status: 403 });
  }

  // Validate against allowed domains
  const isAllowed = ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    return NextResponse.json({ error: 'Target host is not permitted' }, { status: 403 });
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'FlowDesk-Image-Proxy/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: 'Upstream image fetch failed' },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Target resource is not an image' }, { status: 400 });
    }

    const buffer = await upstreamRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    console.warn('[ImageProxy] Failed to proxy image:', err);
    return NextResponse.json(
      { error: 'Failed to fetch image upstream' },
      { status: 500 }
    );
  }
}
