import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, BillingChangePlanSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { razorpaySubscriptionProvider } from '@/backend/billing/razorpay-subscription-provider';
import { getBillingPlan } from '@/shared/billing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_change_plan',
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
      message: 'Only workspace owners can change subscription plans.',
      code: 'FORBIDDEN',
      status: 403,
      requestId,
    });
  }

  // 3. Body Validation
  const bodyValidation = await parseJsonBody(request, BillingChangePlanSchema, {
    maxBytes: 5 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Fallback
  if (isDemoModeActive()) {
    return NextResponse.json(
      { success: true, message: `Plan changed to ${payload.planKey} successfully.` },
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
        message: 'No active subscription found to modify.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Gateway plan modification
    if (subscription.provider_subscription_id) {
      await razorpaySubscriptionProvider.changeSubscriptionPlan(
        subscription.provider_subscription_id,
        payload.planKey,
        payload.interval
      );
    }

    // DB update
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_key: payload.planKey,
        billing_interval: payload.interval,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    const targetPlan = getBillingPlan(payload.planKey);

    logger.security('BILLING_PLAN_CHANGED', {
      status: 'SUCCESS',
      workspaceId: workspace.id,
      userId: caller.userId,
      oldPlanKey: subscription.plan_key,
      newPlanKey: payload.planKey,
      newInterval: payload.interval,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Plan updated to ${targetPlan.name} (${payload.interval}). Changes will reflect on your next billing cycle.`,
      },
      { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    logger.error('BILLING_CHANGE_PLAN_ERROR', { error: err?.message, requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to update subscription plan.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
