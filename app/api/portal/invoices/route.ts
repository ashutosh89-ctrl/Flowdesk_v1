import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, getOrCreateRequestId, createApiErrorResponse } from '@/backend/utilities/logger';
import { derivePaymentStatus, calculateRemainingBalance, isInvoiceOverdue } from '@/shared/utils/invoice-calculations';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Client Portal Invoices API Route
 *
 * GET /api/portal/invoices?clientId=[clientId]
 * Securely retrieves invoices strictly scoped to the specified client without client-side RLS blockers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'portal_invoices_get',
    maxRequests: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return createApiErrorResponse({
      message: 'Client ID is required.',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  // Enforce authentication to prevent unauthenticated enumeration of financial details (VULN-02)
  const caller = await requireApiCaller();
  if (!caller && !isDemoModeActive()) {
    return createApiErrorResponse({
      message: 'Authentication required to view invoices.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        invoices: [],
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  }

  try {
    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, invoices: [], requestId });
    }

    // Resolve canonical client ID if token or email passed
    let resolvedClientId = clientId;
    if (!UUID_REGEX.test(clientId)) {
      const { data: c } = await db
        .from('clients')
        .select('id')
        .or(`portal_token.eq.${clientId},email.eq.${clientId.toLowerCase()}`)
        .limit(1)
        .maybeSingle();
      if (c?.id) {
        resolvedClientId = c.id;
      }
    }

    // Verify client authorization against caller identity (VULN-02 prevention)
    if (caller && !caller.isDemo) {
      const { data: clientRow } = await db
        .from('clients')
        .select('id, workspace_id, user_id')
        .eq('id', resolvedClientId)
        .maybeSingle();

      if (!clientRow) {
        return NextResponse.json({ success: true, invoices: [], requestId });
      }

      const isWorkspaceOwner = caller.workspaceId && caller.workspaceId === clientRow.workspace_id;
      const isClientUser = clientRow.user_id === caller.userId || (caller.clientId && caller.clientId === clientRow.id);

      if (!isWorkspaceOwner && !isClientUser) {
        const { data: conn } = await db
          .from('client_connections')
          .select('id')
          .eq('client_id', clientRow.id)
          .eq('client_user_id', caller.userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!conn) {
          return NextResponse.json({ success: true, invoices: [], requestId });
        }
      }
    }

    // 1. Fetch invoices for this client
    const { data: invoicesData, error: invError } = await db
      .from('invoices')
      .select('*, invoice_items(*), invoice_payments(*), receipts(*)')
      .eq('client_id', resolvedClientId)
      .order('issue_date', { ascending: false });

    if (invError) {
      logger.warn('Failed to query client invoices', { error: invError.message, clientId: resolvedClientId });
      return NextResponse.json({ success: true, invoices: [], requestId });
    }

    if (!invoicesData || invoicesData.length === 0) {
      return NextResponse.json({ success: true, invoices: [], requestId });
    }

    // 2. Query reminder logs for these invoices
    const invoiceIds = invoicesData.map((i) => i.id);
    let remindersByInvoice: Record<string, any[]> = {};
    if (invoiceIds.length > 0) {
      try {
        const { data: reminderLogs } = await db
          .from('reminder_log')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('sent_at', { ascending: true });

        if (reminderLogs) {
          remindersByInvoice = reminderLogs.reduce((acc: any, r: any) => {
            if (!acc[r.invoice_id]) acc[r.invoice_id] = [];
            const count = acc[r.invoice_id].length + 1;
            acc[r.invoice_id].push({
              id: r.id,
              invoiceId: r.invoice_id,
              reminderNumber: count,
              date: r.sent_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              method: 'email',
              status: 'sent',
              notes: `Payment reminder #${count} dispatched to ${r.recipient_email}`,
            });
            return acc;
          }, {});
        }
      } catch {
        // ignore
      }
    }

    // 3. Resolve workspace payment settings / branding
    let defaultQrUrl: string | undefined;
    let defaultUpiId: string | undefined;
    let defaultBankDetails: any = undefined;
    let defaultRazorpayLink: string | undefined;
    let defaultLogoUrl: string | undefined;
    let defaultSignatureUrl: string | undefined;

    const firstInvoice = invoicesData[0];
    if (firstInvoice?.workspace_id) {
      try {
        const { data: ws } = await db
          .from('workspaces')
          .select('owner_id, name, logo_url, signature_url')
          .eq('id', firstInvoice.workspace_id)
          .maybeSingle();

        if (ws) {
          if (ws.logo_url) defaultLogoUrl = ws.logo_url;
          if (ws.signature_url) defaultSignatureUrl = ws.signature_url;
        }

        if (ws?.owner_id) {
          const { data: userSettings } = await db
            .from('user_settings')
            .select('*')
            .eq('id', ws.owner_id)
            .maybeSingle();

          if (userSettings) {
            defaultQrUrl = userSettings.upi_qr_code_url || userSettings.payment_settings?.upiQrCodeUrl || undefined;
            defaultUpiId = userSettings.upi_id || userSettings.payment_settings?.upiId || undefined;
            defaultBankDetails = userSettings.payment_settings?.bankDetails || (userSettings.bank_name ? {
              bankName: userSettings.bank_name,
              accountHolderName: userSettings.account_holder_name || '',
              accountNumber: userSettings.account_number || '',
              ifscCode: userSettings.ifsc_code || '',
              branchName: userSettings.branch_name || '',
              upiId: defaultUpiId || '',
            } : undefined);
            defaultRazorpayLink = userSettings.razorpay_payment_link || userSettings.payment_settings?.razorpayPaymentLink || undefined;
          }

          const { data: prof } = await db
            .from('profiles')
            .select('upi_id, upi_qr_code_url, logo_url, signature_url')
            .eq('id', ws.owner_id)
            .maybeSingle();
          if (prof) {
            if (!defaultQrUrl && prof.upi_qr_code_url) defaultQrUrl = prof.upi_qr_code_url;
            if (!defaultUpiId && prof.upi_id) defaultUpiId = prof.upi_id;
            if (!defaultLogoUrl && prof.logo_url) defaultLogoUrl = prof.logo_url;
            if (!defaultSignatureUrl && prof.signature_url) defaultSignatureUrl = prof.signature_url;
          }
        }
      } catch {
        // non-critical
      }
    }

    // 4. Map invoices
    const formattedInvoices = invoicesData.map((i) => {
      const paidAmt = Number(i.paid_amount) || 0;
      const totalAmt = Number(i.total_amount) || 0;
      const paymentStatus = derivePaymentStatus(totalAmt, paidAmt);
      const isOverdue = isInvoiceOverdue(i.due_date, paymentStatus, i.status || 'sent');

      const persistedReceipts = (i.receipts || []).map((r: any) => ({
        id: r.id,
        receiptNumber: r.receipt_number,
        invoiceId: r.invoice_id,
        invoiceNumber: i.invoice_number,
        amount: Number(r.amount) || 0,
        currency: r.currency || i.currency || 'INR',
        paymentDate: r.payment_date || r.created_at || new Date().toISOString(),
        paymentMethod: r.payment_method || 'razorpay',
        clientName: i.client_name,
        notes: r.notes,
        razorpayPaymentId: r.razorpay_payment_id,
        razorpayOrderId: r.razorpay_order_id,
        gateway: 'razorpay',
        gatewayStatus: 'completed',
      }));

      const receipts = persistedReceipts.length > 0
        ? persistedReceipts
        : (i.invoice_payments || []).map((p: any) => ({
            id: p.id,
            receiptNumber: `RCP-${i.invoice_number || 'INV'}-${(p.id || '').slice(0, 4)}`,
            invoiceId: p.invoice_id,
            invoiceNumber: i.invoice_number,
            amount: Number(p.amount) || 0,
            currency: p.currency || i.currency || 'INR',
            paymentDate: p.payment_date || p.created_at || new Date().toISOString(),
            paymentMethod: p.payment_method || 'bank_transfer',
            clientName: i.client_name,
            notes: p.notes,
            razorpayPaymentId: p.razorpay_payment_id,
            razorpayOrderId: p.razorpay_order_id,
            gateway: p.gateway || 'manual',
            gatewayStatus: p.gateway_status || 'completed',
          }));

      // Parse paymentNotification from internal_notes or invoice_payments if column doesn't exist
      let paymentNotification = (i as any).payment_notification || undefined;
      if (!paymentNotification && i.internal_notes && i.internal_notes.includes('[PAYMENT_NOTIFICATION]:')) {
        try {
          const rawMatch = i.internal_notes.match(/\[PAYMENT_NOTIFICATION\]:\s*(\{.*?\})/);
          if (rawMatch && rawMatch[1]) {
            paymentNotification = JSON.parse(rawMatch[1]);
          }
        } catch {}
      }
      if (!paymentNotification && i.invoice_payments && i.invoice_payments.length > 0) {
        const pendingPayment = i.invoice_payments.find((p: any) => p.gateway_status === 'awaiting_verification');
        if (pendingPayment) {
          paymentNotification = {
            amount: Number(pendingPayment.amount) || totalAmt,
            paymentMethod: pendingPayment.payment_method || 'bank_transfer',
            transactionReference: pendingPayment.notes?.replace('Client submitted payment reference: ', '') || '',
            notifiedAt: pendingPayment.payment_date || pendingPayment.created_at,
            status: 'awaiting_verification',
          };
        }
      }

      const resolvedQrUrl = (i as any).upi_qr_code_url || (i as any).payment_methods?.upiQrCodeUrl || defaultQrUrl;
      const resolvedUpiId = (i as any).upi_id || defaultUpiId;
      const resolvedBankDetails = (i as any).bank_details || (i as any).payment_methods?.bankDetails || defaultBankDetails;
      const resolvedRazorpayLink = (i as any).razorpay_payment_link || (i as any).payment_methods?.razorpayPaymentLink || defaultRazorpayLink;

      return {
        id: i.id,
        invoiceNumber: i.invoice_number,
        clientId: i.client_id,
        clientName: i.client_name || '',
        clientEmail: i.client_email || '',
        projectId: i.project_id || undefined,
        projectName: i.project_name || undefined,
        issueDate: i.issue_date,
        dueDate: i.due_date,
        workflowStatus: (i.workflow_status || i.status || 'sent') as any,
        paymentStatus,
        status: isOverdue ? 'overdue' : (i.status || 'sent'),
        items: (i.invoice_items || []).map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          rate: Number(item.unit_price) || 0,
          amount: Number(item.amount) || 0,
        })),
        subtotal: Number(i.subtotal) || 0,
        discount: Number(i.discount) || 0,
        taxName: i.tax_name || 'GST',
        taxPercentage: Number(i.tax_percentage) || 0,
        tax: Number(i.tax_amount) || 0,
        total: totalAmt,
        paidAmount: paidAmt,
        remainingBalance: calculateRemainingBalance(totalAmt, paidAmt),
        currency: i.currency || 'INR',
        notes: i.notes || '',
        paymentInstructions: i.payment_instructions || '',
        paymentMethods: {
          bankTransferEnabled: Boolean(resolvedBankDetails),
          upiEnabled: Boolean(resolvedUpiId || resolvedQrUrl),
          razorpayLinkEnabled: Boolean(resolvedRazorpayLink),
          upiQrCodeUrl: resolvedQrUrl || undefined,
          upiId: resolvedUpiId || undefined,
          bankDetails: resolvedBankDetails || undefined,
          razorpayPaymentLink: resolvedRazorpayLink || undefined,
        },
        upiId: resolvedUpiId || undefined,
        upiQrCodeUrl: resolvedQrUrl || undefined,
        bankDetails: resolvedBankDetails || undefined,
        razorpayPaymentLink: resolvedRazorpayLink || undefined,
        paymentNotification,
        receipts,
        reminders: remindersByInvoice[i.id] || [],
        logoUrl: (i as any).logo_url || (i as any).branding?.logoUrl || defaultLogoUrl,
        signatureUrl: (i as any).signature_url || (i as any).branding?.signatureUrl || defaultSignatureUrl,
      };
    });

    return NextResponse.json(
      {
        success: true,
        invoices: formattedInvoices,
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected error fetching portal invoices', err, { requestId });
    return NextResponse.json({ success: true, invoices: [], requestId });
  }
}

