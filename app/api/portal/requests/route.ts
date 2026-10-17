import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';

export async function GET(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const data = await PermanentPortalService.getWorkspaceClientRequests(
      caller.workspaceId || undefined,
      caller.userId || undefined
    );

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to load client requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body?.action;
    const connectionId = body?.connectionId || body?.id || body?.clientId;

    if (!connectionId) {
      return NextResponse.json({ success: false, error: 'Connection ID is required' }, { status: 400 });
    }

    if (action === 'approve') {
      const result = await PermanentPortalService.approveClientConnection(
        connectionId,
        caller.workspaceId || undefined,
        caller.userId || undefined
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } else if (action === 'reject') {
      const result = await PermanentPortalService.rejectClientConnection(
        connectionId,
        caller.workspaceId || undefined,
        caller.userId || undefined
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action. Expected approve or reject.' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Operation failed' }, { status: 400 });
  }
}
