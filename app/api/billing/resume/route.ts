import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, BillingResumeSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { razorpaySubscriptionProvider } from '@/backend/billing/razorpay-subscription-provider';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_resume',
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
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
      message: 'Only workspace owners can resume subscriptions.',
      code: 'FORBIDDEN',
      status: 403,
      requestId,
    });
  }

  // 3. Request Validation
  const bodyValidation = await parseJsonBody(request, BillingResumeSchema, {
    maxBytes: 5 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Fallback
  if (isDemoModeActive()) {
    return NextResponse.json(
      { success: true, message: 'Subscription resumed successfully.' },
      { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  }

  // 5. Database & Gateway Execution
  try {
    let workspaceQuery = supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('owner_id', caller.userId);

    if (payload.workspaceId) {
      workspaceQuery = workspaceQuery.eq('id', payload.workspaceId);
    }

    const { data: workspace } = await workspaceQuery.limit(1).maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found for this account.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('status', 'canceled_at_period_end')
      .limit(1)
      .maybeSingle();

    if (!subscription) {
      return createApiErrorResponse({
        message: 'No subscription scheduled for cancellation was found to resume.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Gateway resume
    if (subscription.provider_subscription_id) {
      await razorpaySubscriptionProvider.resumeSubscription(subscription.provider_subscription_id);
    }

    // DB update
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    logger.security('BILLING_SUBSCRIPTION_RESUMED', {
      status: 'SUCCESS',
      workspaceId: workspace.id,
      userId: caller.userId,
      subscriptionId: subscription.id,
      requestId,
    });

    return NextResponse.json(
      { success: true, message: 'Subscription successfully resumed.' },
      { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    logger.error('BILLING_RESUME_ERROR', { error: err?.message, requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to resume subscription.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
