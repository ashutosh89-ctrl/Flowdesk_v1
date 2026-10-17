import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { PermanentPortalService } from '@/backend/portal/permanent-portal-service';

export async function GET(request: NextRequest) {
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return NextResponse.json({ workspaces: [], error: 'Authentication required' }, { status: 401 });
  }

  const userId = caller.userId || (caller.isDemo ? 'usr-demo-client' : '');
  const workspaces = await PermanentPortalService.getClientConnectedWorkspaces(userId);

  return NextResponse.json({ workspaces });
}
