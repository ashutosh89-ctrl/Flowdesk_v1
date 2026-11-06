import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { assertCan } from '@/backend/billing';
import { PlanLimitError } from '@/shared/billing';

/**
 * Audit Log Export Endpoint (Studio-Exclusive Entitlement)
 * 
 * Exports workspace audit events as structured CSV or JSON.
 * Gated by `auditLogExports: true` (Studio Agency plan).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'audit_export',
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many export requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to export audit logs.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  try {
    let workspaceId = caller.workspaceId;
    if (!workspaceId && caller.userId && supabaseAdmin) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws?.id) workspaceId = ws.id;
    }

    const effectiveWsId = workspaceId || caller.userId || 'audit';

    // Strictly enforce Studio-exclusive entitlement: auditLogExports
    try {
      await assertCan(effectiveWsId, 'auditLogExports');
    } catch (err: any) {
      if (err instanceof PlanLimitError) {
        return createApiErrorResponse({
          message: 'Forensic audit log exports are exclusively available on the Studio Agency plan.',
          code: err.code,
          status: 403,
          requestId,
        });
      }
      throw err;
    }

    if (isDemoModeActive()) {
      const { FlowDeskStore } = await import('@/backend/store/storage-store');
      const activities = FlowDeskStore.getActivities();
      return NextResponse.json({
        success: true,
        auditLogs: activities,
        requestId,
      });
    }

    const { data: activities, error } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('workspace_id', effectiveWsId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      return createApiErrorResponse({
        message: 'Failed to retrieve audit log records.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      auditLogs: activities || [],
      requestId,
    });
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
