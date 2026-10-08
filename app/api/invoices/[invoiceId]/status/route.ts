import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, UpdateInvoiceStatusSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { canTransitionInvoiceWorkflow, ActorRole } from '@/shared/rules';

/**
 * Invoice Status Transition Route Handler (Batch 1: Money & Invoices)
 *
 * Secure server-side mediation for invoice state transitions (sent, viewed, cancelled).
 * Invariants:
 * 1. Requires authenticated session.
 * 2. Rate limited (30 requests/min).
 * 3. Strict UUID parameter and Zod payload validation.
 * 4. Derived actor role ('freelancer' vs 'client').
 * 5. State machine transition check from shared pure rules.
 * 6. Non-blocking server-side email dispatch and activity feed logging.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_status',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('INVOICE_STATUS_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Rate limit exceeded on invoice status update',
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
    logger.security('INVOICE_STATUS_UNAUTHORIZED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Missing authenticated session',
    });
    return createApiErrorResponse({
      message: 'Authentication required to update invoice status.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Route Parameter Validation
  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.invoiceId, uuidSchema, 'invoiceId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const invoiceId = paramValidation.data;

  // 4. Request Body Validation
  const bodyValidation = await parseJsonBody(request, UpdateInvoiceStatusSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { status: targetStatus, notes } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    logger.info(`[Demo Mode] Updated invoice ${invoiceId} status to ${targetStatus}`, {
      requestId,
      callerId: caller.userId,
    });
    return NextResponse.json(
      {
        success: true,
        message: `Invoice status updated to ${targetStatus} (demo mode).`,
        invoice: {
          id: invoiceId,
          status: targetStatus,
          updated_at: new Date().toISOString(),
          notes: notes || undefined,
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

  // 6. Production Database Execution & Multi-Tenant Authorization
  try {
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, workspace_id, client_id, client_email, client_name, invoice_number, status, total_amount, due_date, currency')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchError || !invoice) {
      logger.warn(`Invoice ${invoiceId} not found during status update`, {
        requestId,
        callerId: caller.userId,
      });
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // Determine caller role and workspace authorization
    let isAuthorized = false;
    let actorRole: ActorRole = 'freelancer';

    // Check workspace owner
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', invoice.workspace_id)
      .maybeSingle();

    if (workspace && (workspace.owner_id === caller.userId || (workspace as any).user_id === caller.userId)) {
      isAuthorized = true;
      actorRole = 'freelancer';
    }

    // Check client assignment
    if (!isAuthorized && invoice.client_id) {
      const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('id, user_id')
        .eq('id', invoice.client_id)
        .maybeSingle();

      if (clientRecord && clientRecord.user_id === caller.userId) {
        isAuthorized = true;
        actorRole = 'client';
      }
    }

    if (!isAuthorized) {
      logger.security('INVOICE_STATUS_FORBIDDEN', {
        requestId,
        ip,
        callerId: caller.userId,
        invoiceId,
        status: 'BLOCKED',
        reason: 'Caller lacks ownership or client affiliation for invoice',
      });
      return createApiErrorResponse({
        message: 'You are not authorized to update this invoice.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. Pure State Machine Transition Validation
    const transitionCheck = canTransitionInvoiceWorkflow(invoice.status || 'draft', targetStatus, actorRole);
    if (!transitionCheck.allowed) {
      return createApiErrorResponse({
        message: transitionCheck.reason || 'Invalid invoice status transition.',
        code: 'INVALID_STATUS_TRANSITION',
        status: 400,
        requestId,
      });
    }

    // 8. Atomic State Transition Update
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        status: targetStatus,
        updated_at: nowIso,
      })
      .eq('id', invoiceId)
      .eq('workspace_id', invoice.workspace_id)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update invoice status in database', updateError, {
        requestId,
        invoiceId,
      });
      return createApiErrorResponse({
        message: 'Failed to update invoice status.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        internalError: updateError,
        requestId,
      });
    }

    // 9. Server-Side Side Effects (Non-blocking)
    // A. Activity Feed Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: invoice.workspace_id,
        client_id: invoice.client_id,
        action: `${targetStatus}_invoice`,
        title: `Invoice #${invoice.invoice_number} ${targetStatus.toUpperCase()}`,
        description: `Invoice status changed to ${targetStatus}.${notes ? ` Notes: ${notes}` : ''}`,
        resource_type: 'invoice',
        resource_id: invoiceId,
      });
    } catch (activityErr) {
      logger.warn('Non-critical activity log failed for invoice status', {
        requestId,
        error: String(activityErr),
      });
    }

    // B. Email Dispatch on 'sent' status
    if (targetStatus === 'sent' && invoice.client_email) {
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

        await EmailService.sendInvoiceIssued(
          invoice.client_email,
          {
            clientName: invoice.client_name || 'Client',
            freelancerName: studioName,
            invoiceNumber: invoice.invoice_number,
            amount: `${invoice.currency || '$'} ${(invoice.total_amount || 0).toLocaleString()}`,
            dueDate: invoice.due_date || new Date().toISOString().split('T')[0],
            invoiceUrl: `${getAppBaseUrl()}/portal/${invoice.client_id}`,
          },
          { workspaceId: invoice.workspace_id, invoiceId }
        );
      } catch (emailErr) {
        logger.warn('Non-critical email dispatch failed for invoice send', {
          requestId,
          error: String(emailErr),
        });
      }
    }

    logger.security('INVOICE_STATUS_UPDATED', {
      requestId,
      status: 'SUCCESS',
      invoiceId,
      targetStatus,
      workspaceId: invoice.workspace_id,
      actorRole,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invoice status transitioned to ${targetStatus}.`,
        invoice: updated,
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
    logger.error('Unexpected exception during invoice status update', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error processing invoice status update.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
