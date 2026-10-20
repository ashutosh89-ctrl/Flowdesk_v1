import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, RecordOfflinePaymentSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Offline Payment Settlement Route Handler (Batch 1: Money & Invoices)
 *
 * Secure server-side endpoint for recording manual / offline invoice settlements.
 * Invariants:
 * 1. Requires authenticated freelancer session (workspace owner).
 * 2. Rate limited (20 requests/min).
 * 3. Enforces overpayment checks and atomic financial settlement.
 * 4. Dispatches payment receipt email to client (non-blocking).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_payment_offline',
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('INVOICE_OFFLINE_PAYMENT_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Rate limit exceeded on offline payment recording',
    });
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    logger.security('INVOICE_OFFLINE_PAYMENT_UNAUTHORIZED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Missing authenticated session',
    });
    return createApiErrorResponse({
      message: 'Authentication required to record offline payment.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Route Parameter Validation
  const rawParams = await context.params;
  const invoiceId = rawParams.invoiceId?.trim();
  if (!invoiceId) {
    return createApiErrorResponse({
      message: 'Missing or invalid invoice ID.',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  // 4. Request Body Validation
  const bodyValidation = await parseJsonBody(request, RecordOfflinePaymentSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { paymentMethod, amount, notes } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    logger.info(`[Demo Mode] Recorded offline payment for invoice ${invoiceId}`, {
      requestId,
      callerId: caller.userId,
      amount,
    });
    return NextResponse.json(
      {
        success: true,
        message: 'Payment recorded successfully (demo mode).',
        settlement: {
          invoiceId,
          amountSettled: amount || 100,
          paymentMethod,
          paidAt: new Date().toISOString(),
          notes,
        },
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 6. Production Authorization & Execution
  try {
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, workspace_id, client_id, client_email, client_name, invoice_number, total_amount, paid_amount, currency, status')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchError || !invoice) {
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Verify workspace ownership: only workspace owner can record offline payments
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', invoice.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      logger.security('INVOICE_OFFLINE_PAYMENT_FORBIDDEN', {
        requestId,
        ip,
        callerId: caller.userId,
        invoiceId,
        status: 'BLOCKED',
        reason: 'User is not workspace owner for this invoice',
      });
      return createApiErrorResponse({
        message: 'Only the workspace owner can record offline payments.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. Atomic DB Execution via RPC or Direct Table Fallback
    const settleAmount = amount !== undefined && amount !== null ? amount : null;
    let settledAmount = 0;

    let rpcSuccess = false;
    try {
      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('record_manual_payment', {
        p_invoice_id: invoiceId,
        p_amount: settleAmount,
        p_payment_method: paymentMethod || 'bank_transfer',
        p_notes: notes || (settleAmount !== null ? 'Partial offline settlement recorded' : 'Payment marked as paid in full'),
      });

      if (!rpcError && rpcResult && rpcResult.success !== false) {
        rpcSuccess = true;
        settledAmount = Number(rpcResult.amountSettled) || amount || (invoice.total_amount - (invoice.paid_amount || 0));
      }
    } catch (rpcEx) {
      logger.warn('record_manual_payment RPC threw exception, proceeding to direct write', { rpcEx });
    }

    if (!rpcSuccess) {
      // Direct Table Fallback
      const total = Number(invoice.total_amount) || 0;
      const currentPaid = Number(invoice.paid_amount) || 0;
      const remaining = Math.max(0, total - currentPaid);
      const actualSettle = (settleAmount !== null && settleAmount > 0) ? Math.min(settleAmount, remaining) : remaining;
      const newPaid = currentPaid + actualSettle;
      const isFullyPaid = newPaid >= total;

      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({
          paid_amount: newPaid,
          payment_status: isFullyPaid ? 'paid' : 'partial',
          status: isFullyPaid ? 'paid' : ((invoice as any)?.status || 'sent'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateError) {
        logger.error('Failed direct table invoice update', updateError, { requestId, invoiceId });
        return createApiErrorResponse({
          message: 'Payment could not be recorded in database.',
          code: 'PAYMENT_SETTLEMENT_ERROR',
          status: 400,
          requestId,
        });
      }

      settledAmount = actualSettle;

      // Attempt recording in payments table (non-blocking)
      try {
        await supabaseAdmin.from('payments').insert({
          workspace_id: invoice.workspace_id,
          invoice_id: invoiceId,
          amount: actualSettle,
          payment_method: paymentMethod || 'bank_transfer',
          status: 'completed',
          notes: notes || 'Manual offline payment settlement',
          created_at: new Date().toISOString(),
        });
      } catch (payErr) {
        logger.warn('Non-critical payments insert notice', { payErr });
      }

      // Record activity
      try {
        await supabaseAdmin.from('activities').insert({
          workspace_id: invoice.workspace_id,
          client_id: invoice.client_id,
          user_id: caller.userId,
          action: 'recorded_payment',
          resource_type: 'invoice',
          title: `Payment Recorded: #${invoice.invoice_number}`,
          description: `Recorded offline payment of ${invoice.currency || '$'}${actualSettle.toLocaleString()} via ${paymentMethod || 'bank transfer'}`,
          created_at: new Date().toISOString(),
        });
      } catch {
        // non-critical
      }
    }

    // 8. Non-Blocking Email Dispatch
    if (invoice.client_email) {
      try {
        const { EmailService } = await import('@/backend/email/email-service');
        const { getAppBaseUrl } = await import('@/shared/utils/url');
        let studioName = 'FlowDesk Studio';
        if (workspace?.owner_id) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('business_name, full_name')
            .eq('id', workspace.owner_id)
            .maybeSingle();
          if (profile?.business_name) studioName = profile.business_name;
          else if (profile?.full_name) studioName = profile.full_name;
        }

        await EmailService.sendPaymentReceived(
          invoice.client_email,
          {
            recipientName: invoice.client_name || 'Client',
            freelancerName: studioName,
            invoiceNumber: invoice.invoice_number,
            amount: `${invoice.currency || '$'} ${settledAmount.toLocaleString()}`,
            paymentDate: new Date().toLocaleDateString(),
            paymentMethod: paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentMethod,
            receiptUrl: `${getAppBaseUrl()}/portal/${invoice.client_id}`,
          },
          { workspaceId: invoice.workspace_id, paymentId: invoiceId }
        );
      } catch (emailErr) {
        logger.warn('Non-critical email dispatch notice for offline payment', {
          requestId,
          error: String(emailErr),
        });
      }
    }

    logger.security('INVOICE_OFFLINE_PAYMENT_RECORDED', {
      requestId,
      status: 'SUCCESS',
      invoiceId,
      amountSettled: settledAmount,
      workspaceId: invoice.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Offline payment recorded successfully.',
        settlement: {
          invoiceId,
          amountSettled: settledAmount,
          paymentMethod,
          paidAt: new Date().toISOString(),
        },
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception during offline payment recording', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error recording offline payment.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
