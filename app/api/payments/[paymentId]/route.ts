import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { FlowDeskStore } from '@/backend/store/storage-store';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    // 1. Authentication required — this endpoint returns financial data.
    const caller = await requireApiCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { paymentId } = await context.params;
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;
    const isUuid = UUID_REGEX.test(paymentId);

    let payment: any = null;
    let error: any = null;

    if (isUuid) {
      const res = await db
        .from('invoice_payments')
        .select('*, invoices(invoice_number, client_name, currency, total_amount, paid_amount, status, client_id, workspace_id), receipts(*)')
        .or(`id.eq.${paymentId},razorpay_payment_id.eq.${paymentId}`)
        .maybeSingle();
      payment = res.data;
      error = res.error;
    } else {
      const res = await db
        .from('invoice_payments')
        .select('*, invoices(invoice_number, client_name, currency, total_amount, paid_amount, status, client_id, workspace_id), receipts(*)')
        .eq('razorpay_payment_id', paymentId)
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
          const rcp = (inv.receipts || []).find((r: any) => r.id === paymentId || r.razorpayPaymentId === paymentId);
          if (rcp) {
            return NextResponse.json({
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
          }
        }
      }
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // 3. Authorization: resolve payment → invoice → ownership.
    const invoice = payment.invoices || {};
    if (!caller.isDemo) {
      if (caller.clientId) {
        if (!invoice.client_id || invoice.client_id !== caller.clientId) {
          return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
        }
      } else if (caller.workspaceId) {
        if (!invoice.workspace_id || invoice.workspace_id !== caller.workspaceId) {
          return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
      }
    }

    const receipt = payment.receipts?.[0];

    // Safe return without internal database or secret details
    return NextResponse.json({
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
  } catch (error: any) {
    console.error('[API /api/payments/[paymentId]] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}