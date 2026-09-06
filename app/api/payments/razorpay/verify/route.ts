import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication: the caller must be an authenticated Supabase session
    //    (or an explicitly configured demo environment).
    const caller = await requireApiCaller();
    if (!caller) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to verify a payment.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, paymentId, signature } = body;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters (orderId, paymentId, signature).',
        },
        { status: 400 }
      );
    }

    // 2. Authorization: client identity is derived server-side from the session.
    //    The browser-supplied clientId is NEVER trusted.
    const result = await PaymentService.verifyAndCapturePayment({
      orderId,
      paymentId,
      signature,
      clientId: caller.clientId || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Payment verification failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/payments/razorpay/verify] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error verifying payment.' },
      { status: 500 }
    );
  }
}