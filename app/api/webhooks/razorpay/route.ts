import { NextRequest, NextResponse } from 'next/server';
import { RazorpayService, PaymentService, fromSubunits } from '@/backend/payments';

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body as text for HMAC verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      console.warn('[Webhook /api/webhooks/razorpay] Missing X-Razorpay-Signature header');
      return NextResponse.json(
        { error: 'Missing webhook signature header' },
        { status: 400 }
      );
    }

    // 2. Validate HMAC signature against RAZORPAY_WEBHOOK_SECRET
    const isValid = RazorpayService.verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      console.warn('[Webhook /api/webhooks/razorpay] Invalid webhook signature detected.');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // 3. Parse JSON event payload
    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    console.info(`[Webhook /api/webhooks/razorpay] Authoritative event: ${eventType} (ID: ${event.id || 'n/a'})`);

    switch (eventType) {
      case 'payment.captured': {
        const paymentEntity = payload?.payment?.entity;
        if (paymentEntity) {
          const orderId = paymentEntity.order_id;
          const paymentId = paymentEntity.id;
          const currency = (paymentEntity.currency || 'INR').toUpperCase();
          const amount = fromSubunits(paymentEntity.amount, currency);
          const method = paymentEntity.method || 'razorpay';
          const capturedAt = paymentEntity.created_at
            ? new Date(paymentEntity.created_at * 1000).toISOString()
            : new Date().toISOString();

          const result = await PaymentService.processCapturedPayment({
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            amount,
            currency,
            method,
            capturedAt,
          });

          if (!result.success) {
            console.warn(`[Webhook /api/webhooks/razorpay] Payment processing notice: ${result.error}`);
            // Return 200 with notice or 400 if unmapped
            if (result.errorCode === 'UNRESOLVED_PAYMENT') {
              return NextResponse.json(
                { success: false, code: 'UNRESOLVED_PAYMENT', error: result.error },
                { status: 400 }
              );
            }
          }
        }
        break;
      }

      case 'order.paid': {
        const orderEntity = payload?.order?.entity;
        const paymentEntity = payload?.payment?.entity;

        if (paymentEntity) {
          const orderId = orderEntity?.id || paymentEntity.order_id;
          const paymentId = paymentEntity.id;
          const currency = (paymentEntity.currency || orderEntity?.currency || 'INR').toUpperCase();
          const amount = fromSubunits(paymentEntity.amount, currency);

          await PaymentService.processCapturedPayment({
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            amount,
            currency,
            method: paymentEntity.method || 'razorpay',
            capturedAt: new Date().toISOString(),
          });
        }
        break;
      }

      case 'payment.failed': {
        const paymentEntity = payload?.payment?.entity;
        if (paymentEntity) {
          await PaymentService.processFailedPayment({
            razorpayOrderId: paymentEntity.order_id,
            razorpayPaymentId: paymentEntity.id,
            reason: paymentEntity.error_description || paymentEntity.error_reason || 'Payment failed',
          });
        }
        break;
      }

      case 'payment.authorized': {
        console.info(`[Webhook /api/webhooks/razorpay] Payment authorized: ${payload?.payment?.entity?.id}`);
        break;
      }

      default:
        console.info(`[Webhook /api/webhooks/razorpay] Ignored unhandled event: ${eventType}`);
        break;
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error('[Webhook /api/webhooks/razorpay] Webhook handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
