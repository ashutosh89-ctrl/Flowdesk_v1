import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { LaunchPromotionService } from '@/backend/billing/launch-promotion-service';

export const runtime = 'nodejs';

/**
 * POST /api/billing/trial/dismiss-announcement
 * Records that the workspace owner has seen and dismissed the 30-day Standard launch gift modal.
 * Ensures the welcome modal is displayed only once per workspace.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'trial_dismiss_announcement',
    maxRequests: 30,
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

  if (isDemoModeActive() || caller.isDemo) {
    return NextResponse.json({ success: true, message: 'Dismissed in demo mode.' });
  }

  try {
    let wsId = caller.workspaceId;
    if (!wsId && supabaseAdmin && caller.userId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws?.id) wsId = ws.id;
    }

    if (!wsId) {
      return createApiErrorResponse({
        message: 'No active workspace found for this account.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const success = await LaunchPromotionService.dismissAnnouncement(wsId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return createApiErrorResponse({
      message: err?.message || 'Failed to dismiss announcement.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

