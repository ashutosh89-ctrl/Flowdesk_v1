import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';

export async function GET(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  const settings = await PermanentPortalService.getFreelancerPortalSettings(origin);
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await PermanentPortalService.updateFreelancerPortalSettings({
      isAcceptingConnections: body.isAcceptingConnections,
      portalSlug: body.portalSlug,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Invalid request' }, { status: 400 });
  }
}
