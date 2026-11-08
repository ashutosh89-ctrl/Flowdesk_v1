import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { validateRouteParam, uuidSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { EmailService } from '@/backend/email/email-service';
import { getAppBaseUrl } from '@/shared/utils/url';

/**
 * Manual Send-Reminder Route
 *
 * POST /api/invoices/[invoiceId]/reminder
 * Allows freelancer to manually dispatch an invoice reminder email.
 * Updates reminder_log and respects stop conditions.
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_manual_reminder',
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

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.invoiceId, uuidSchema, 'invoiceId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const invoiceId = paramValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Reminder sent successfully (demo mode).',
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (invError || !invoice) {
      return createApiErrorResponse({
        message: 'Invoice not found in your workspace.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Stop conditions: Cannot send reminder for draft or cancelled
    if (invoice.status === 'draft') {
      return createApiErrorResponse({
        message: 'Cannot send reminder for a draft invoice. Please send the invoice first.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    if (invoice.status === 'cancelled') {
      return createApiErrorResponse({
        message: 'Cannot send reminder for a cancelled invoice.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    const total = Number(invoice.total_amount) || 0;
    const paid = Number(invoice.paid_amount) || 0;
    const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);

    if (remaining <= 0 || paid >= total) {
      return createApiErrorResponse({
        message: 'Invoice is already fully paid.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    if (!invoice.client_email || !invoice.client_email.includes('@')) {
      return createApiErrorResponse({
        message: 'Client does not have a valid email address.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    // Fetch all prior reminders for this invoice to accurately sequence reminders (1, 2, 3...)
    const { data: reminderLogs } = await supabaseAdmin
      .from('reminder_log')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sent_at', { ascending: true });

    const existingCount = reminderLogs?.length || 0;
    if (existingCount >= 3) {
      return createApiErrorResponse({
        message: 'Maximum limit of 3 manual reminders reached for this invoice.',
        code: 'MAX_REMINDERS_REACHED',
        status: 400,
        requestId,
      });
    }

    // Debounce to prevent accidental double-clicks within 30 seconds
    if (existingCount > 0 && reminderLogs) {
      const lastSentTime = new Date(reminderLogs[existingCount - 1].sent_at).getTime();
      const secondsSinceLast = (Date.now() - lastSentTime) / 1000;
      if (secondsSinceLast < 30) {
        const remainingSeconds = Math.ceil(30 - secondsSinceLast);
        return createApiErrorResponse({
          message: `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before sending another reminder.`,
          code: 'REMINDER_COOLDOWN',
          status: 429,
          requestId,
        });
      }
    }

    const reminderNum = existingCount + 1;

    // Resolve Studio Name
    let studioName = 'FlowDesk Studio';
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('business_name, full_name')
        .eq('id', caller.userId)
        .maybeSingle();

      if (profile?.business_name) studioName = profile.business_name;
      else if (profile?.full_name) studioName = profile.full_name;
    } catch { /* fallback */ }

    const baseUrl = getAppBaseUrl();
    const portalUrl = invoice.client_id ? `${baseUrl}/portal/${invoice.client_id}` : `${baseUrl}/portal/login`;
    const curr = invoice.currency || '$';
    const ruleKey = `manual_${reminderNum}_${Date.now()}`;

    // Determine stage
    const dueDate = new Date(invoice.due_date);
    const now = new Date();
    const isOverdue = now.getTime() > dueDate.getTime();
    const stage = isOverdue ? 'after_due' : 'before_due';

    const sendRes = await EmailService.sendInvoiceReminder(
      invoice.client_email,
      {
        clientName: invoice.client_name || 'Client',
        freelancerName: studioName,
        invoiceNumber: invoice.invoice_number,
        amountFormatted: `${curr} ${total.toLocaleString()}`,
        remainingBalanceFormatted: `${curr} ${remaining.toLocaleString()}`,
        dueDate: invoice.due_date || new Date().toISOString().split('T')[0],
        portalUrl,
        stage,
      },
      {
        workspaceId: workspace.id,
        invoiceId: invoice.id,
        ruleKey,
      }
    );

    if (!sendRes.success || sendRes.suppressed) {
      return createApiErrorResponse({
        message: sendRes.error || (sendRes.suppressed ? 'Email reminder was suppressed by email delivery rules or notification settings.' : 'Failed to dispatch email reminder.'),
        code: 'EMAIL_DISPATCH_FAILED',
        status: 500,
        requestId,
      });
    }

    const nowIso = new Date().toISOString();

    // 1. Log reminder in reminder_log
    const { data: insertedLog } = await supabaseAdmin
      .from('reminder_log')
      .insert({
        workspace_id: workspace.id,
        invoice_id: invoice.id,
        rule_key: ruleKey,
        recipient_email: invoice.client_email,
        sent_at: nowIso,
      })
      .select()
      .single();

    // 2. Persistent In-App Notification for Client (Instant Portal Alert)
    if (invoice.client_id) {
      await supabaseAdmin.from('notifications').insert({
        workspace_id: workspace.id,
        client_id: invoice.client_id,
        user_id: null,
        title: `Payment Reminder: Invoice #${invoice.invoice_number}`,
        message: `Payment reminder #${reminderNum} for ${curr} ${remaining.toLocaleString()} on Invoice #${invoice.invoice_number} (Due: ${invoice.due_date || 'immediate'}).`,
        category: 'invoice',
        link: 'invoices',
        priority: 'high',
        read: false,
      });
    }

    // 3. Persistent In-App Notification for Freelancer (Audit Confirmation)
    await supabaseAdmin.from('notifications').insert({
      workspace_id: workspace.id,
      client_id: null,
      user_id: workspace.owner_id,
      title: `Payment Reminder #${reminderNum} Sent`,
      message: `Dispatched payment reminder #${reminderNum} for Invoice #${invoice.invoice_number} to ${invoice.client_email}.`,
      category: 'invoice',
      link: 'invoices',
      priority: 'medium',
      read: false,
    });

    // 4. Log in activities feed
    await supabaseAdmin.from('activities').insert({
      workspace_id: workspace.id,
      client_id: invoice.client_id || null,
      action: 'sent_reminder',
      title: invoice.invoice_number,
      description: `Payment reminder #${reminderNum} dispatched to ${invoice.client_email}`,
      resource_type: 'invoice',
      resource_id: invoice.id,
    });

    logger.security('INVOICE_REMINDER_SENT_MANUALLY', {
      requestId,
      status: 'SUCCESS',
      invoiceId: invoice.id,
      workspaceId: workspace.id,
      recipient: invoice.client_email,
      reminderNumber: reminderNum,
    });

    const newReminder = {
      id: insertedLog?.id || ruleKey,
      invoiceId: invoice.id,
      reminderNumber: reminderNum,
      date: nowIso.split('T')[0],
      method: 'email' as const,
      status: 'sent' as const,
      notes: `Payment reminder #${reminderNum} dispatched to ${invoice.client_email}`,
    };

    const updatedReminders = [
      ...(reminderLogs || []).map((r: any, idx: number) => ({
        id: r.id,
        invoiceId: r.invoice_id,
        reminderNumber: idx + 1,
        date: r.sent_at?.split('T')[0] || nowIso.split('T')[0],
        method: 'email' as const,
        status: 'sent' as const,
        notes: `Payment reminder #${idx + 1} dispatched to ${r.recipient_email}`,
      })),
      newReminder,
    ];

    const updatedInvoice = {
      ...invoice,
      reminders: updatedReminders,
    };

    return NextResponse.json(
      {
        success: true,
        message: `Payment reminder #${reminderNum} dispatched successfully.`,
        reminderCount: reminderNum,
        reminder: newReminder,
        invoice: updatedInvoice,
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected error sending manual invoice reminder', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
