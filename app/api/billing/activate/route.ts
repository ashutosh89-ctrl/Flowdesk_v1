import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { getBillingPlan, PlanKey, BillingInterval } from '@/shared/billing';
import { invalidateWorkspaceEntitlements } from '@/backend/billing';
import { z } from 'zod';

const ActivateBillingSchema = z.object({
  planKey: z.enum(['standard', 'studio']),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
  paymentId: z.string().trim().min(1, 'Payment ID is required'),
  orderId: z.string().trim().optional(),
  subscriptionId: z.string().trim().optional(),
  signature: z.string().trim().optional(),
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'billing_activate',
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many activation attempts. Please wait a moment.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to activate subscriptions.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createApiErrorResponse({
      message: 'Invalid JSON request payload.',
      code: 'INVALID_JSON',
      status: 400,
      requestId,
    });
  }

  const parsed = ActivateBillingSchema.safeParse(body);
  if (!parsed.success) {
    return createApiErrorResponse({
      message: parsed.error.issues[0]?.message || 'Invalid activation data.',
      code: 'VALIDATION_ERROR',
      status: 400,
      requestId,
    });
  }

  const { planKey, interval, paymentId, subscriptionId, orderId, signature } = parsed.data;

  // Demo Mode Simulation
  if (isDemoModeActive()) {
    return NextResponse.json({
      success: true,
      message: `Activated ${planKey} (${interval}) in demo mode.`,
      planKey,
      interval,
    });
  }

  const plan = getBillingPlan(planKey);
  const expectedAmountPaise = plan.pricing[interval].INR * 100;

  // Server-Authoritative Gateway Payment Verification
  const { isRazorpayConfigured, getRazorpayClient } = await import('@/backend/payments/razorpay-client');
  if (isRazorpayConfigured()) {
    try {
      const razorpay = getRazorpayClient();
      const payment = await razorpay.payments.fetch(paymentId);

      if (!payment) {
        return createApiErrorResponse({
          message: 'Payment record could not be found with payment gateway.',
          code: 'PAYMENT_NOT_FOUND',
          status: 400,
          requestId,
        });
      }

      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return createApiErrorResponse({
          message: `Payment is not in an authorized or captured state (status: ${payment.status}).`,
          code: 'PAYMENT_NOT_CAPTURED',
          status: 400,
          requestId,
        });
      }

      if (payment.amount < expectedAmountPaise) {
        return createApiErrorResponse({
          message: 'Payment amount does not match required plan pricing.',
          code: 'AMOUNT_MISMATCH',
          status: 400,
          requestId,
        });
      }
    } catch (gateErr: any) {
      logger.error('Gateway payment verification error', gateErr, { requestId });
      return createApiErrorResponse({
        message: gateErr?.message || 'Failed to verify payment with Razorpay gateway.',
        code: 'GATEWAY_VERIFICATION_ERROR',
        status: 400,
        requestId,
      });
    }
  }

  try {
    // Determine workspace
    let workspaceQuery = supabaseAdmin
      .from('workspaces')
      .select('id, owner_id, name')
      .eq('owner_id', caller.userId);

    if (caller.workspaceId) {
      workspaceQuery = workspaceQuery.eq('id', caller.workspaceId);
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

    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'yearly') {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    // Upsert subscription into Supabase
    const { error: upsertErr } = await supabaseAdmin.from('subscriptions').upsert(
      {
        workspace_id: workspace.id,
        plan_key: planKey,
        status: 'active',
        billing_interval: interval,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
        provider: 'razorpay',
        provider_subscription_id: subscriptionId || paymentId,
        provider_customer_id: null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'workspace_id' }
    );

    if (upsertErr) {
      logger.error('Failed to update subscription record in database:', {
        workspaceId: workspace.id,
        error: upsertErr.message,
        requestId,
      });
      return createApiErrorResponse({
        message: 'Failed to record subscription upgrade in database.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    // Invalidate entitlements cache
    invalidateWorkspaceEntitlements(workspace.id);

    // Touch workspace timestamp so realtime subscribers refresh immediately
    await supabaseAdmin
      .from('workspaces')
      .update({ updated_at: now.toISOString() })
      .eq('id', workspace.id);

    const plan = getBillingPlan(planKey);

    logger.security('BILLING_SUBSCRIPTION_ACTIVATED', {
      status: 'SUCCESS',
      workspaceId: workspace.id,
      userId: caller.userId,
      planKey,
      interval,
      paymentId,
      requestId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${plan.name}.`,
      planKey,
      interval,
      currentPeriodEnd: periodEnd.toISOString(),
    });
  } catch (err: any) {
    logger.error('BILLING_ACTIVATION_EXCEPTION', { error: err?.message, requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to activate billing upgrade.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

