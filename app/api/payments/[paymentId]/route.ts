import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { logger, createApiErrorResponse } from '@/backend/utilities/logger';
import { validateRouteParam, paymentIdParamSchema, uuidSchema } from '@/shared/validation';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, {
      prefix: 'payment_lookup',
      maxRequests: 60,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 1. Authentication required — this endpoint returns financial data.
    const caller = await requireApiCaller();
    if (!caller) {
      return NextResponse.json(
        { error: 'Authentication required.', code: 'UNAUTHORIZED' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { paymentId } = await context.params;
    const paramValidation = validateRouteParam(paymentId, paymentIdParamSchema, 'paymentId');
    if (!paramValidation.success) {
      return paramValidation.response;
    }
    const cleanPaymentId = paramValidation.data;

    const db = supabaseAdmin || supabase;
    const isUuid = uuidSchema.safeParse(cleanPaymentId).success;

    let payment: any = null;
    let error: any = null;

    if (isUuid) {
      // Direct parameterized query for UUID
      const res = await db
        .from('invoice_payments')
        .select('*, invoices(invoice_number, client_name, currency, total_amount, paid_amount, status, client_id, workspace_id), receipts(*)')
        .eq('id', cleanPaymentId)
        .maybeSingle();
      payment = res.data;
      error = res.error;
    } else {
      // Direct parameterized query for Razorpay payment ID
      const res = await db
        .from('invoice_payments')
        .select('*, invoices(invoice_number, client_name, currency, total_amount, paid_amount, status, client_id, workspace_id), receipts(*)')
        .eq('razorpay_payment_id', cleanPaymentId)
        .maybeSingle();
      payment = res.data;
      error = res.error;
    }

    // 2. Demo-only fallback: resolve from FlowDeskStore ONLY in explicitly
    //    configured demo environments. Production never falls back to local state.
    if (error || !payment) {
      if (isDemoModeActive()) {
        const demoInvs = FlowDeskStore.getInvoices();
        for (const inv of demoInvs) {
          const rcp = (inv.receipts || []).find((r: any) => r.id === cleanPaymentId || r.razorpayPaymentId === cleanPaymentId);
          if (rcp) {
            const demoRes = NextResponse.json({
              id: rcp.id,
              receiptNumber: rcp.receiptNumber,
              razorpayPaymentId: rcp.razorpayPaymentId || rcp.id,
              razorpayOrderId: rcp.razorpayOrderId,
              amount: rcp.amount,
              currency: rcp.currency || 'USD',
              gateway: 'razorpay',
              gatewayStatus: 'completed',
              paymentDate: rcp.paymentDate,
              invoiceNumber: inv.invoiceNumber,
              clientName: inv.clientName,
              invoiceStatus: inv.status,
            });
            demoRes.headers.set('Cache-Control', 'no-store');
            return demoRes;
          }
        }
      }
      return NextResponse.json(
        { error: 'Payment record not found', code: 'NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Authorization: resolve payment → invoice → ownership.
    const invoice = payment.invoices || {};
    if (!caller.isDemo) {
      if (caller.clientId) {
        if (!invoice.client_id || invoice.client_id !== caller.clientId) {
          return NextResponse.json(
            { error: 'Payment record not found', code: 'NOT_FOUND' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } else if (caller.workspaceId) {
        if (!invoice.workspace_id || invoice.workspace_id !== caller.workspaceId) {
          return NextResponse.json(
            { error: 'Payment record not found', code: 'NOT_FOUND' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Payment record not found', code: 'NOT_FOUND' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    const receipt = payment.receipts?.[0];

    // Safe return without internal database or secret details
    const response = NextResponse.json({
      id: payment.id,
      receiptNumber: receipt?.receipt_number || `RCP-${invoice.invoice_number || 'INV'}-${payment.id.slice(0, 4)}`,
      receiptId: receipt?.id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpayOrderId: payment.razorpay_order_id,
      amount: Number(payment.amount) || 0,
      currency: payment.currency || invoice.currency || 'USD',
      gateway: payment.gateway || 'manual',
      gatewayStatus: payment.gateway_status || 'completed',
      paymentDate: payment.payment_date || payment.created_at,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      invoiceStatus: invoice.status,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: any) {
    logger.error('[API /api/payments/[paymentId]] Error', error);
    return createApiErrorResponse({
      message: 'Failed to retrieve payment record.',
      code: 'PAYMENT_LOOKUP_ERROR',
      status: 500,
      internalError: error,
    });
  }
}