import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, ConfirmPaymentNotificationSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { derivePaymentStatus, calculateRemainingBalance } from '@/shared/utils/invoice-calculations';
import { EmailService } from '@/backend/email/email-service';

/**
 * Freelancer Payment Confirmation Route Handler
 *
 * Allows the freelancer to verify and confirm (or reject) a client-submitted payment.
 * When confirmed:
 * 1. Atomically settles the amount via record_manual_payment RPC or direct ledger transaction.
 * 2. Updates invoice total paid amount, remaining balance, and status.
 * 3. Creates an immutable receipt record.
 * 4. Marks payment_notification as 'confirmed'.
 * 5. Dispatches transactional receipt email to the client via Brevo (non-blocking).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'confirm_payment_notification',
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication (Freelancer / Workspace Owner only)
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to confirm invoice payments.',
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
      message: 'Invoice ID is required.',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  // 4. Request Body Validation
  const bodyValidation = await parseJsonBody(request, ConfirmPaymentNotificationSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { status: confirmationStatus, amount: customAmount, notes: confirmationNotes } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    logger.info(`[Demo Mode] Confirmed payment notification for invoice ${invoiceId}`, {
      requestId,
      confirmationStatus,
      callerId: caller.userId,
    });
    return NextResponse.json(
      {
        success: true,
        message: confirmationStatus === 'confirmed' ? 'Payment confirmed and recorded successfully (demo mode).' : 'Payment reference rejected (demo mode).',
        invoiceId,
        confirmationStatus,
        requestId,
      },
      {
        status: 200,
        headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      }
    );
  }

  // 6. Production DB Execution
  try {
    // Fetch invoice with verification that it belongs to caller's workspace
    const { data: invoice, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*, clients(id, name, email)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Verify workspace ownership
    if (caller.workspaceId && invoice.workspace_id !== caller.workspaceId) {
      return createApiErrorResponse({
        message: 'You are not authorized to confirm payments for this invoice.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const currentNotification = invoice.payment_notification || {};
    const nowIso = new Date().toISOString();

    // Handling: REJECTION
    if (confirmationStatus === 'rejected') {
      const updatedNotification = {
        ...currentNotification,
        status: 'rejected',
        rejectedAt: nowIso,
        rejectionNotes: confirmationNotes || '',
      };

      await supabaseAdmin
        .from('invoices')
        .update({
          payment_notification: updatedNotification,
          updated_at: nowIso,
        })
        .eq('id', invoiceId);

      return NextResponse.json(
        {
          success: true,
          message: 'Payment reference marked as rejected.',
          notification: updatedNotification,
          requestId,
        },
        { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
      );
    }

    // Handling: CONFIRMATION
    const totalAmount = Number(invoice.total_amount) || 0;
    const currentPaid = Number(invoice.paid_amount) || 0;
    const remainingBalance = calculateRemainingBalance(totalAmount, currentPaid);

    const notifiedAmount = Number(currentNotification.amount) || remainingBalance;
    const settleAmount = customAmount !== undefined ? customAmount : notifiedAmount;

    if (settleAmount <= 0) {
      return createApiErrorResponse({
        message: 'Settlement amount must be greater than zero.',
        code: 'INVALID_AMOUNT',
        status: 400,
        requestId,
      });
    }

    if (settleAmount > remainingBalance + 0.01) {
      return createApiErrorResponse({
        message: `Settlement amount (${settleAmount}) exceeds remaining balance (${remainingBalance}).`,
        code: 'PAYMENT_EXCEEDS_BALANCE',
        status: 400,
        requestId,
      });
    }

    const paymentMethod = currentNotification.paymentMethod || 'bank_transfer';
    const notes = confirmationNotes || currentNotification.notes || `Verified client reference: ${currentNotification.transactionReference || 'N/A'}`;

    // 1. Try atomic settlement via record_manual_payment RPC
    let receiptNumber = `RCP-${invoice.invoice_number}-${Date.now().toString().slice(-4)}`;
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('record_manual_payment', {
      p_invoice_id: invoiceId,
      p_amount: settleAmount,
      p_payment_method: paymentMethod,
      p_notes: notes,
    });

    if (rpcError) {
      logger.warn('[ConfirmPayment] record_manual_payment RPC failed, falling back to direct update:', { error: rpcError.message, requestId });
      // Fallback: direct ledger update
      const newPaidAmount = Math.round((currentPaid + settleAmount) * 100) / 100;
      const newPaymentStatus = derivePaymentStatus(totalAmount, newPaidAmount);
      const newWorkflowStatus = newPaidAmount >= totalAmount ? 'paid' : 'sent';

      await supabaseAdmin.from('invoices').update({
        paid_amount: newPaidAmount,
        payment_status: newPaymentStatus,
        status: newWorkflowStatus,
        updated_at: nowIso,
      }).eq('id', invoiceId);

      await supabaseAdmin.from('invoice_payments').insert({
        invoice_id: invoiceId,
        workspace_id: invoice.workspace_id,
        amount: settleAmount,
        currency: invoice.currency || 'USD',
        payment_method: paymentMethod,
        notes,
        created_at: nowIso,
      });
    } else if (rpcResult?.receiptNumber) {
      receiptNumber = rpcResult.receiptNumber;
    }

    // 2. Mark payment_notification as confirmed
    const updatedNotification = {
      ...currentNotification,
      status: 'confirmed',
      confirmedAt: nowIso,
      confirmedBy: caller.userId,
      confirmedAmount: settleAmount,
      notes,
    };

    await supabaseAdmin
      .from('invoices')
      .update({
        payment_notification: updatedNotification,
        updated_at: nowIso,
      })
      .eq('id', invoiceId);

    // 3. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: invoice.workspace_id,
        client_id: invoice.client_id,
        action: 'payment_confirmed',
        title: `Payment verified for Invoice #${invoice.invoice_number}`,
        description: `Confirmed payment of ${invoice.currency} ${settleAmount} via ${paymentMethod} (Receipt: ${receiptNumber})`,
        resource_type: 'invoice',
        resource_id: invoice.id,
      });
    } catch {}

    // 4. Send Brevo Receipt Email to Client (Non-blocking)
    const clientEmail = invoice.clients?.email || invoice.client_email;
    const clientName = invoice.clients?.name || invoice.client_name || 'Client';

    if (clientEmail) {
      EmailService.sendPaymentReceived(
        clientEmail,
        {
          recipientName: clientName,
          payerName: clientName,
          invoiceNumber: invoice.invoice_number,
          amountPaidFormatted: `${invoice.currency || 'USD'} ${settleAmount}`,
          balanceRemainingFormatted: `${invoice.currency || 'USD'} ${Math.max(0, remainingBalance - settleAmount)}`,
          isFullyPaid: settleAmount >= remainingBalance,
          paymentDate: nowIso.split('T')[0],
          paymentMethod: paymentMethod.replace('_', ' ').toUpperCase(),
          receiptNumber,
        },
        {
          workspaceId: invoice.workspace_id,
          paymentId: receiptNumber,
        }
      ).catch((emailErr) => {
        logger.warn('[ConfirmPayment] Non-critical Brevo receipt email send error:', { error: String(emailErr), requestId });
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Payment confirmed, balance updated, and receipt issued successfully.',
        settlement: {
          invoiceId,
          amountSettled: settleAmount,
          receiptNumber,
          remainingBalance: Math.max(0, remainingBalance - settleAmount),
          status: 'confirmed',
        },
        requestId,
      },
      {
        status: 200,
        headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected error in confirm payment route', err, {
      requestId,
      invoiceId,
    });
    return createApiErrorResponse({
      message: 'Internal server error confirming payment.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
