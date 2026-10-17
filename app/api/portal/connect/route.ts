import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit(clientIp, {
    prefix: 'portal_connect',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many connection attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json(
      { success: false, error: 'You must be signed in to connect with a freelancer.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const slug = body?.slug;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid portal identifier is required.' },
        { status: 400 }
      );
    }

    const userId = caller.userId || (caller.isDemo ? 'usr-demo-client' : '');
    const result = await PermanentPortalService.connectClient(slug, userId);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Invalid request.' },
      { status: 400 }
    );
  }
}
