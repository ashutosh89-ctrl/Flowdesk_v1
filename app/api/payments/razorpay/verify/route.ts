import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse } from '@/backend/utilities/logger';
import { parseJsonBody, VerifyPaymentSchema } from '@/shared/validation';


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

    // 1b. User-level rate limiting check
    const callerId = caller.userId || caller.clientId || 'caller';
    const userRateLimit = await checkRateLimit(`user:${callerId}`, RATE_LIMIT_PRESETS.PAYMENT_VERIFY);
    if (!userRateLimit.allowed) {
      logger.security('PAYMENT_VERIFY_RATE_LIMITED', {
        userId: callerId,
        status: 'BLOCKED',
        reason: 'User rate limit exceeded',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many payment verification requests for your account. Please try again in ${userRateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(userRateLimit.retryAfterSeconds) },
        }
      );
    }

    const bodyResult = await parseJsonBody(request, VerifyPaymentSchema, {
      maxBytes: 10 * 1024,
    });
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const { orderId, paymentId, signature } = bodyResult.data;

    // 2. Authorization: client identity is derived server-side from the session.
    //    The browser-supplied clientId is NEVER trusted.
    const result = await PaymentService.verifyAndCapturePayment({
      orderId,
      paymentId,
      signature,
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

    const res = NextResponse.json(result);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error: any) {
    logger.error('[API /api/payments/razorpay/verify] Error', error, { ip: clientIp });
    return createApiErrorResponse({
      message: 'Failed to verify payment.',
      code: 'PAYMENT_VERIFY_ERROR',
      status: 500,
      internalError: error,
    });
  }
}