import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, ClientPaymentNotificationSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Client Payment Notification Route Handler
 *
 * Allows a client to submit transaction reference / UTR for manual payment (Bank or UPI).
 * Critical Security Rule:
 * A client-submitted reference NEVER marks an invoice as paid.
 * It is recorded as 'awaiting_verification' until confirmed by the freelancer.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting (max 10 requests / min per IP)
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'client_payment_notification',
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('CLIENT_PAYMENT_NOTIFY_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
    });
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication (client or session)
  const caller = await requireApiCaller();
  if (!caller && !isDemoModeActive()) {
    return createApiErrorResponse({
      message: 'Authentication or valid client portal session required.',
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
  const bodyValidation = await parseJsonBody(request, ClientPaymentNotificationSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { amount, paymentMethod, transactionReference, notes } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    const demoNotification = {
      amount,
      paymentMethod,
      transactionReference,
      notes,
      notifiedAt: new Date().toISOString(),
      status: 'awaiting_verification' as const,
    };
    logger.info(`[Demo Mode] Recorded payment notification for invoice ${invoiceId}`, {
      requestId,
      transactionReference,
      amount,
    });
    return NextResponse.json(
      {
        success: true,
        message: 'Payment notification recorded. Awaiting freelancer verification.',
        notification: demoNotification,
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
    const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    let invQuery = supabaseAdmin
      .from('invoices')
      .select('id, workspace_id, client_id, invoice_number, total_amount, paid_amount, currency, status, internal_notes');

    if (UUID_PATTERN.test(invoiceId)) {
      invQuery = invQuery.or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`);
    } else {
      invQuery = invQuery.eq('invoice_number', invoiceId);
    }

    const { data: invRows, error: fetchErr } = await invQuery.limit(1);
    const invoice = invRows?.[0] || null;

    if (fetchErr || !invoice) {
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    if (invoice.status === 'cancelled') {
      return createApiErrorResponse({
        message: 'Cannot submit payment notification for a cancelled invoice.',
        code: 'INVOICE_CANCELLED',
        status: 400,
        requestId,
      });
    }

    // Multi-tenant authorization verification
    if (caller && !caller.isDemo) {
      const isWorkspaceOwner = Boolean(caller.workspaceId && caller.workspaceId === invoice.workspace_id);
      const isInvoiceClient = Boolean(caller.clientId && caller.clientId === invoice.client_id);

      let isAuthorized = isWorkspaceOwner || isInvoiceClient;
      if (!isAuthorized && caller.userId) {
        if (invoice.client_id) {
          const { data: cRow } = await supabaseAdmin
            .from('clients')
            .select('id, user_id')
            .eq('id', invoice.client_id)
            .maybeSingle();
          if (cRow?.user_id && cRow.user_id === caller.userId) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          const { data: conns } = await supabaseAdmin
            .from('client_connections')
            .select('id')
            .eq('client_user_id', caller.userId)
            .eq('status', 'active')
            .limit(1);
          if (conns && conns.length > 0) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized && invoice.workspace_id) {
          const { data: wsClients } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('workspace_id', invoice.workspace_id)
            .eq('user_id', caller.userId)
            .limit(1);
          if (wsClients && wsClients.length > 0) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return createApiErrorResponse({
          message: 'You are not authorized to submit payment notifications for this invoice.',
          code: 'FORBIDDEN',
          status: 403,
          requestId,
        });
      }
    }

    const paymentDateIso = new Date().toISOString();
    const notificationPayload = {
      amount,
      paymentMethod,
      transactionReference,
      notes: notes || '',
      notifiedAt: paymentDateIso,
      status: 'awaiting_verification',
    };

    // 1. Record pending payment entry in verified invoice_payments ledger
    try {
      if (invoice.workspace_id && invoice.id) {
        await supabaseAdmin.from('invoice_payments').insert({
          invoice_id: invoice.id,
          workspace_id: invoice.workspace_id,
          amount,
          currency: invoice.currency || 'INR',
          payment_method: paymentMethod || 'upi',
          payment_date: paymentDateIso,
          notes: `Reference/UTR: ${transactionReference}${notes ? ' - ' + notes : ''}`,
        });
      }
    } catch (payErr) {
      logger.warn('[NotifyPayment] invoice_payments insert notice:', { error: String(payErr) });
    }

    // 2. Persist notification metadata into invoices.internal_notes for guaranteed schema compatibility
    try {
      const existingNotes = invoice.internal_notes || '';
      const cleanNotes = existingNotes.replace(/\[PAYMENT_NOTIFICATION\]:[\s\S]*?(?=\n\[|$)/, '').trim();
      const newInternalNotes = `[PAYMENT_NOTIFICATION]: ${JSON.stringify(notificationPayload)}${cleanNotes ? '\n' + cleanNotes : ''}`;

      await supabaseAdmin
        .from('invoices')
        .update({
          internal_notes: newInternalNotes,
          updated_at: paymentDateIso,
        })
        .eq('id', invoice.id);
    } catch (updateErr) {
      logger.warn('[NotifyPayment] internal_notes update notice:', { error: String(updateErr) });
    }

    // 3. Non-blocking attempt on optional payment_notification column
    try {
      await supabaseAdmin
        .from('invoices')
        .update({ payment_notification: notificationPayload })
        .eq('id', invoice.id);
    } catch {
      // Column does not exist in standard relational schema
    }

    // 4. In-App Notifications for Freelancer & Client
    try {
      if (invoice.workspace_id) {
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('owner_id')
          .eq('id', invoice.workspace_id)
          .maybeSingle();

        if (ws?.owner_id) {
          await supabaseAdmin.from('notifications').insert({
            workspace_id: invoice.workspace_id,
            user_id: ws.owner_id,
            client_id: null,
            title: 'Payment Submitted (Pending Verification)',
            message: `Payment reference ${transactionReference} submitted for #${invoice.invoice_number} (${invoice.currency} ${amount}). Please verify in Invoices.`,
            category: 'invoice',
            link: 'invoices',
            read: false,
          });
        }

        if (invoice.client_id) {
          await supabaseAdmin.from('notifications').insert({
            workspace_id: invoice.workspace_id,
            user_id: null,
            client_id: invoice.client_id,
            title: 'Payment Reference Submitted',
            message: `Your payment reference (${transactionReference}) for #${invoice.invoice_number} was submitted and is pending verification.`,
            category: 'invoice',
            link: 'invoices',
            read: false,
          });
        }
      }
    } catch {
      // Non-critical notification insert
    }

    // 5. Non-blocking Activity Log
    try {
      if (invoice.workspace_id) {
        await supabaseAdmin.from('activities').insert({
          workspace_id: invoice.workspace_id,
          client_id: invoice.client_id || null,
          action: 'payment_notification_submitted',
          title: `Payment reference submitted for #${invoice.invoice_number}`,
          description: `Client submitted reference ${transactionReference} for ${invoice.currency} ${amount} awaiting verification.`,
          resource_type: 'invoice',
          resource_id: invoice.id,
        });
      }
    } catch {
      // Non-critical activity insert
    }

    // 8. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Payment notification recorded successfully. Awaiting freelancer verification.',
        notification: notificationPayload,
        requestId,
      },
      {
        status: 200,
        headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected error in client payment notification route', err, {
      requestId,
      invoiceId,
    });
    return createApiErrorResponse({
      message: 'Internal server error processing payment notification.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
