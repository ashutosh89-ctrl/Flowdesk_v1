import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, BillingCancelSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { razorpaySubscriptionProvider } from '@/backend/billing/razorpay-subscription-provider';
import { canTransitionSubscription } from '@/shared/billing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_cancel',
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
      message: 'Only workspace owners can cancel subscriptions.',
      code: 'FORBIDDEN',
      status: 403,
      requestId,
    });
  }

  // 3. Body Validation
  const bodyValidation = await parseJsonBody(request, BillingCancelSchema, {
    maxBytes: 5 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Fallback
  if (isDemoModeActive()) {
    return NextResponse.json(
      { success: true, message: 'Subscription scheduled for cancellation at period end.' },
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
      .not('status', 'in', '("canceled","expired")')
      .limit(1)
      .maybeSingle();

    if (!subscription) {
      return createApiErrorResponse({
        message: 'No active paid subscription found to cancel.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // State machine check
    const targetStatus = payload.atPeriodEnd ? 'canceled_at_period_end' : 'canceled';
    if (!canTransitionSubscription(subscription.status, targetStatus)) {
      return createApiErrorResponse({
        message: `Cannot cancel subscription currently in '${subscription.status}' state.`,
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    // Gateway cancellation
    if (subscription.provider_subscription_id) {
      await razorpaySubscriptionProvider.cancelSubscription(
        subscription.provider_subscription_id,
        payload.atPeriodEnd
      );
    }

    // DB update
    const updatePayload: Record<string, any> = {
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    };
    if (!payload.atPeriodEnd) {
      updatePayload.status = 'canceled';
      updatePayload.canceled_at = new Date().toISOString();
    } else {
      updatePayload.status = 'canceled_at_period_end';
    }

    await supabaseAdmin
      .from('subscriptions')
      .update(updatePayload)
      .eq('id', subscription.id);

    logger.security('BILLING_SUBSCRIPTION_CANCELLED', {
      status: 'SUCCESS',
      workspaceId: workspace.id,
      userId: caller.userId,
      subscriptionId: subscription.id,
      atPeriodEnd: payload.atPeriodEnd,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        message: payload.atPeriodEnd
          ? 'Subscription will cancel at the end of the current billing cycle.'
          : 'Subscription cancelled immediately.',
      },
      { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    logger.error('BILLING_CANCEL_ERROR', { error: err?.message, requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to cancel subscription.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
