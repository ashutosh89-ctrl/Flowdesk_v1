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
    const portalUrl = `${baseUrl}/portal/login`;
    const curr = invoice.currency || '$';
    const ruleKey = `manual_${Date.now()}`;

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

    if (!sendRes.success && !sendRes.suppressed) {
      return createApiErrorResponse({
        message: sendRes.error || 'Failed to dispatch email reminder.',
        code: 'EMAIL_DISPATCH_FAILED',
        status: 500,
        requestId,
      });
    }

    // Log reminder in reminder_log
    await supabaseAdmin.from('reminder_log').insert({
      workspace_id: workspace.id,
      invoice_id: invoice.id,
      rule_key: ruleKey,
      recipient_email: invoice.client_email,
      sent_at: new Date().toISOString(),
    });

    logger.security('INVOICE_REMINDER_SENT_MANUALLY', {
      requestId,
      status: 'SUCCESS',
      invoiceId: invoice.id,
      workspaceId: workspace.id,
      recipient: invoice.client_email,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Payment reminder sent successfully.',
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
