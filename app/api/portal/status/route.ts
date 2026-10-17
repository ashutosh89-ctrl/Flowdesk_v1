import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit(clientIp, {
    prefix: 'portal_status',
    maxRequests: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json(
      { isConnected: false, isOwner: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Portal identifier required' }, { status: 400 });
  }

  const userId = caller.userId || (caller.isDemo ? 'usr-demo-client' : '');
  const result = await PermanentPortalService.checkConnectionStatus(slug, userId);
  return NextResponse.json(result);
}
