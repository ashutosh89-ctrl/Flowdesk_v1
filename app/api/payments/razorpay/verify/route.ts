import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger } from '@/backend/utilities/logger';

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  try {
    // 0. Rate limiting protection
    const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_PRESETS.PAYMENT_VERIFY);
    if (!rateLimit.allowed) {
      logger.security('PAYMENT_VERIFY_RATE_LIMITED', {
        ip: clientIp,
        status: 'BLOCKED',
        reason: 'Rate limit exceeded',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many verification attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
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
      logger.security('PAYMENT_VERIFY_UNAUTHORIZED', {
        ip: clientIp,
        status: 'BLOCKED',
        reason: 'Missing authenticated session',
      });
      return NextResponse.json(
        { success: false, error: 'Authentication required to verify a payment.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, paymentId, signature } = body;

    if (
      !orderId ||
      typeof orderId !== 'string' ||
      !paymentId ||
      typeof paymentId !== 'string' ||
      !signature ||
      typeof signature !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required parameters (orderId, paymentId, signature).',
        },
        { status: 400 }
      );
    }

    // 2. Authorization: client identity is derived server-side from the session.
    //    The browser-supplied clientId is NEVER trusted.
    const result = await PaymentService.verifyAndCapturePayment({
      orderId: orderId.trim(),
      paymentId: paymentId.trim(),
      signature: signature.trim(),
      clientId: caller.clientId || undefined,
    });

    if (!result.success) {
      logger.security('PAYMENT_VERIFICATION_FAILED', {
        userId: caller.userId,
        clientId: caller.clientId,
        orderId,
        paymentId,
        status: 'FAILURE',
        reason: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error || 'Payment verification failed.' },
        { status: 400 }
      );
    }

    logger.security('PAYMENT_VERIFICATION_SUCCESS', {
      userId: caller.userId,
      clientId: caller.clientId,
      orderId,
      paymentId,
      status: 'SUCCESS',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('[API /api/payments/razorpay/verify] Error', error, { ip: clientIp });
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error verifying payment.' },
      { status: 500 }
    );
  }
}