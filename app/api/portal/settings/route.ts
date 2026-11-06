import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';

export async function GET(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  const settings = await PermanentPortalService.getFreelancerPortalSettings(
    origin,
    caller.userId || undefined,
    caller.workspaceId || undefined
  );
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Enforce customSubpaths entitlement: Only Studio plan can customize portalSlug
    if (body.portalSlug !== undefined && body.portalSlug !== null) {
      const { assertCan } = await import('@/backend/billing');
      const { PlanLimitError } = await import('@/shared/billing');
      let wsId = caller.workspaceId;
      if (!wsId && caller.userId) {
        const { supabaseAdmin } = await import('@/backend/utilities/supabase');
        if (supabaseAdmin) {
          const { data: ws } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', caller.userId)
            .limit(1)
            .maybeSingle();
          if (ws?.id) wsId = ws.id;
        }
      }

      try {
        await assertCan(wsId || caller.userId || 'portal', 'customSubpaths');
      } catch (err: any) {
        if (err instanceof PlanLimitError) {
          return NextResponse.json({
            success: false,
            error: 'Custom portal subpaths and unique URLs are exclusively available on the Studio Agency plan.',
            code: err.code,
          }, { status: 403 });
        }
        throw err;
      }
    }

    const result = await PermanentPortalService.updateFreelancerPortalSettings(
      {
        isAcceptingConnections: body.isAcceptingConnections,
        portalSlug: body.portalSlug,
        portalMode: body.portalMode,
      },
      caller.userId || undefined,
      caller.workspaceId || undefined
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Invalid request' }, { status: 400 });
  }
}
