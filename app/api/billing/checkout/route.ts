import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, BillingCheckoutSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { razorpaySubscriptionProvider } from '@/backend/billing/razorpay-subscription-provider';
import { getBillingPlan } from '@/shared/billing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_checkout',
    maxRequests: 15,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many checkout requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to manage subscriptions.',
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
      message: 'Only workspace owners can initiate subscription checkout.',
      code: 'FORBIDDEN',
      status: 403,
      requestId,
    });
  }

  // 3. Request Validation
  const bodyValidation = await parseJsonBody(request, BillingCheckoutSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Fallback
  if (isDemoModeActive()) {
    const plan = getBillingPlan(payload.planKey);
    return NextResponse.json(
      {
        success: true,
        provider: 'razorpay',
        providerSubscriptionId: `sub_demo_${payload.planKey}_${Date.now()}`,
        checkoutPayload: {
          keyId: 'rzp_test_demo_placeholder',
          subscriptionId: `sub_demo_${payload.planKey}_${Date.now()}`,
          customerName: 'Demo Studio',
          customerEmail: 'demo@flowdesk.app',
          amount: plan.pricing[payload.interval].INR * 100,
          currency: 'INR',
        },
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 5. Database & Gateway Execution
  try {
    let workspaceQuery = supabaseAdmin
      .from('workspaces')
      .select('id, owner_id, name')
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

    // Server-authoritative subscription creation
    const subscriptionResult = await razorpaySubscriptionProvider.createSubscription({
      workspaceId: workspace.id,
      workspaceOwnerId: caller.userId || workspace.owner_id,
      workspaceOwnerEmail: 'billing@flowdesk.app',
      workspaceOwnerName: workspace.name || 'Studio Owner',
      planKey: payload.planKey,
      interval: payload.interval,
    });

    // Record or update subscription in DB as pending/created
    if (supabaseAdmin) {
      await supabaseAdmin.from('subscriptions').upsert(
        {
          workspace_id: workspace.id,
          plan_key: payload.planKey,
          billing_interval: payload.interval,
          status: 'trialing',
          provider: 'razorpay',
          provider_subscription_id: subscriptionResult.providerSubscriptionId,
          provider_customer_id: subscriptionResult.providerCustomerId || null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      );
    }

    logger.security('BILLING_CHECKOUT_INITIATED', {
      status: 'SUCCESS',
      workspaceId: workspace.id,
      userId: caller.userId,
      planKey: payload.planKey,
      interval: payload.interval,
      subscriptionId: subscriptionResult.providerSubscriptionId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        provider: subscriptionResult.provider,
        providerSubscriptionId: subscriptionResult.providerSubscriptionId,
        checkoutPayload: subscriptionResult.checkoutPayload,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('BILLING_CHECKOUT_ERROR', { error: err?.message, requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to initiate billing checkout.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
