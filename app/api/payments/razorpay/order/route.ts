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
        { success: false, error: 'Authentication required to create a payment order.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invoiceId, requestedAmount, partialPayment } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Missing required invoiceId parameter.' },
        { status: 400 }
      );
    }

    // 2. Authorization: identity is derived server-side from the session.
    //    Browser-supplied clientId/workspaceId are NEVER trusted.
    const result = await PaymentService.createPaymentOrder({
      invoiceId,
      clientId: caller.clientId || undefined,
      workspaceId: caller.workspaceId || undefined,
      requestedAmount: requestedAmount !== undefined ? Number(requestedAmount) : undefined,
      partialPayment: Boolean(partialPayment),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create payment order.' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/payments/razorpay/order] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error processing payment order.' },
      { status: 500 }
    );
  }
}