import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse } from '@/backend/utilities/logger';
import { parseJsonBody, CreatePaymentOrderSchema } from '@/shared/validation';


export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  try {
    // 0. Rate limiting check by IP
    const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_PRESETS.PAYMENT_ORDER);
    if (!rateLimit.allowed) {
      logger.security('PAYMENT_ORDER_RATE_LIMITED', {
        ip: clientIp,
        status: 'BLOCKED',
        reason: 'Rate limit exceeded',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many payment order requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    // 1. Authentication: the caller must be an authenticated Supabase session
    //    (or an explicitly configured demo environment).
    const caller = await requireApiCaller();
    if (!caller) {
      logger.security('PAYMENT_ORDER_UNAUTHORIZED', {
        ip: clientIp,
        status: 'BLOCKED',
        reason: 'Missing authenticated session',
      });
      return NextResponse.json(
        { success: false, error: 'Authentication required to create a payment order.' },
        { status: 401 }
      );
    }

    // 1b. User-level rate limiting check
    const callerId = caller.userId || caller.clientId || 'caller';
    const userRateLimit = await checkRateLimit(`user:${callerId}`, RATE_LIMIT_PRESETS.PAYMENT_ORDER);
    if (!userRateLimit.allowed) {
      logger.security('PAYMENT_ORDER_RATE_LIMITED', {
        userId: callerId,
        status: 'BLOCKED',
        reason: 'User rate limit exceeded',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many payment order requests for your account. Please try again in ${userRateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(userRateLimit.retryAfterSeconds) },
        }
      );
    }

    const bodyResult = await parseJsonBody(request, CreatePaymentOrderSchema, {
      maxBytes: 10 * 1024,
    });
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const { invoiceId, requestedAmount, partialPayment } = bodyResult.data;

    // 2. Authorization: identity is derived server-side from the session.
    //    Browser-supplied clientId/workspaceId are NEVER trusted.
    const result = await PaymentService.createPaymentOrder({
      invoiceId,
      clientId: caller.clientId || undefined,
      workspaceId: caller.workspaceId || undefined,
      requestedAmount,
      partialPayment: Boolean(partialPayment),
    });


    if (!result.success) {
      logger.security('PAYMENT_ORDER_CREATION_FAILED', {
        userId: caller.userId,
        clientId: caller.clientId,
        workspaceId: caller.workspaceId,
        invoiceId,
        status: 'FAILURE',
        reason: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create payment order.' },
        { status: 400 }
      );
    }

    logger.security('PAYMENT_ORDER_CREATED', {
      userId: caller.userId,
      clientId: caller.clientId,
      workspaceId: caller.workspaceId,
      invoiceId,
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency,
      status: 'SUCCESS',
    });

    const res = NextResponse.json(result);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error: any) {
    logger.error('[API /api/payments/razorpay/order] Error', error, { ip: clientIp });
    return createApiErrorResponse({
      message: 'Failed to process payment order.',
      code: 'PAYMENT_ORDER_ERROR',
      status: 500,
      internalError: error,
    });
  }
}