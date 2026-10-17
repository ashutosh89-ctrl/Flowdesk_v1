import { NextRequest, NextResponse } from 'next/server';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit(clientIp, {
    prefix: 'portal_resolve',
    maxRequests: 180,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(
      { valid: false, error: 'Portal identifier is required.' },
      { status: 400 }
    );
  }

  const result = await PermanentPortalService.resolvePermanentPortal(slug);
  return NextResponse.json(result, {
    status: result.valid ? 200 : 404,
    headers: {
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
    },
  });
}
