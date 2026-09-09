import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger } from '@/backend/utilities/logger';

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

    const body = await request.json();
    const { invoiceId, requestedAmount, partialPayment } = body;

    if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid invoiceId parameter.' },
        { status: 400 }
      );
    }

    let parsedAmount: number | undefined = undefined;
    if (requestedAmount !== undefined && requestedAmount !== null) {
      const num = Number(requestedAmount);
      if (isNaN(num) || !isFinite(num) || num <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid requestedAmount. Must be a positive finite number.' },
          { status: 400 }
        );
      }
      parsedAmount = num;
    }

    // 2. Authorization: identity is derived server-side from the session.
    //    Browser-supplied clientId/workspaceId are NEVER trusted.
    const result = await PaymentService.createPaymentOrder({
      invoiceId: invoiceId.trim(),
      clientId: caller.clientId || undefined,
      workspaceId: caller.workspaceId || undefined,
      requestedAmount: parsedAmount,
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

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('[API /api/payments/razorpay/order] Error', error, { ip: clientIp });
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error processing payment order.' },
      { status: 500 }
    );
  }
}