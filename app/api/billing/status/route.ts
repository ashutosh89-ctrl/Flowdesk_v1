import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { getWorkspaceEntitlements } from '@/backend/billing/entitlements';
import { BILLING_PLANS } from '@/shared/billing';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_status',
    maxRequests: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const isClientCaller =
    (caller.isDemo && request.headers.get('x-flowdesk-role') === 'client') ||
    (!caller.isDemo && Boolean(caller.clientId && !caller.workspaceId));

  if (isClientCaller) {
    return createApiErrorResponse({
      message: 'Only workspace owners can view workspace billing status.',
      code: 'FORBIDDEN',
      status: 403,
      requestId,
    });
  }

  // 3. Demo Mode Fallback
  if (isDemoModeActive()) {
    const entitlements = await getWorkspaceEntitlements('demo-workspace');
    return NextResponse.json(
      {
        entitlements,
        plans: BILLING_PLANS,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 4. Resolve Workspace
  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id, name')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found for this account.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const entitlements = await getWorkspaceEntitlements(workspace.id);

    return NextResponse.json(
      {
        entitlements,
        plans: BILLING_PLANS,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    return createApiErrorResponse({
      message: err?.message || 'Failed to retrieve billing status.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
