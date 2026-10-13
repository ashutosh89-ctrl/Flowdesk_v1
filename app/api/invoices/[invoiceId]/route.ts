import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, UpdateInvoiceSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { calculateInvoiceTotals } from '@/shared/rules';

/**
 * Invoice Mutation Route Handler (Batch 1: Money & Invoices)
 *
 * Secure server-side updates & deletion of invoice statements:
 * - Recalculates financials server-side on items/tax/discount change.
 * - Restricts mutations strictly to the authenticated workspace owner.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_update',
    maxRequests: 30,
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

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to modify invoices.',
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
  const bodyValidation = await parseJsonBody(request, UpdateInvoiceSchema, {
    maxBytes: 50 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Invoice updated successfully (demo mode).',
        invoice: {
          id: invoiceId,
          ...updates,
          updated_at: new Date().toISOString(),
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

  try {
    // 6. Fetch existing invoice and verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', existing.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can update this invoice.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. Recalculate totals if items, tax, or discount changed
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.issueDate) dbPayload.issue_date = updates.issueDate;
    if (updates.dueDate) dbPayload.due_date = updates.dueDate;
    if (updates.currency) dbPayload.currency = updates.currency;
    if (updates.notes !== undefined) dbPayload.notes = updates.notes;
    if (updates.paymentInstructions !== undefined) dbPayload.payment_instructions = updates.paymentInstructions;
    if (updates.internalNotes !== undefined) dbPayload.internal_notes = updates.internalNotes;
    if (updates.taxName !== undefined) dbPayload.tax_name = updates.taxName;

    if (updates.items || updates.taxPercentage !== undefined || updates.discount !== undefined) {
      const itemsToCalc = updates.items || [];
      const taxRate = updates.taxPercentage ?? existing.tax_percentage ?? 0;
      const discountVal = updates.discount ?? existing.discount ?? 0;

      const calc = calculateInvoiceTotals({
        items: itemsToCalc,
        taxPercentage: taxRate,
        discount: discountVal,
      });

      dbPayload.subtotal = calc.subtotal;
      dbPayload.tax_percentage = calc.taxPercentage;
      dbPayload.tax_amount = calc.taxAmount;
      dbPayload.discount = calc.discount;
      dbPayload.total_amount = calc.total;

      // Sync line items in invoice_items table
      if (updates.items) {
        await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', invoiceId);
        if (updates.items.length > 0) {
          const itemRows = updates.items.map((it) => ({
            invoice_id: invoiceId,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.rate,
            amount: Math.round(it.quantity * it.rate * 100) / 100,
          }));
          await supabaseAdmin.from('invoice_items').insert(itemRows);
        }
      }
    }

    // 8. Update Invoice Record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(dbPayload)
      .eq('id', invoiceId)
      .eq('workspace_id', existing.workspace_id)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update invoice in database', updateError, { requestId, invoiceId });
      return createApiErrorResponse({
        message: 'Failed to update invoice.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    // 9. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: existing.workspace_id,
        client_id: existing.client_id,
        action: 'updated_invoice',
        title: `Updated Invoice #${existing.invoice_number}`,
        description: `Invoice #${existing.invoice_number} details were updated.`,
        resource_type: 'invoice',
        resource_id: invoiceId,
      });
    } catch { /* non-critical */ }

    logger.security('INVOICE_UPDATED', {
      requestId,
      status: 'SUCCESS',
      invoiceId,
      workspaceId: existing.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Invoice updated successfully.',
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
    logger.error('Unexpected exception during invoice update', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error updating invoice.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_delete',
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
      message: 'Authentication required to delete invoices.',
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
    return NextResponse.json({ success: true, message: 'Invoice deleted (demo mode).' }, { status: 200 });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('id, workspace_id, invoice_number, client_id')
      .eq('id', invoiceId)
      .maybeSingle();

    if (!existing) {
      return createApiErrorResponse({
        message: 'Invoice not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', existing.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can delete this invoice.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', invoiceId);
    await supabaseAdmin.from('invoice_payments').delete().eq('invoice_id', invoiceId);
    const { error: delError } = await supabaseAdmin.from('invoices').delete().eq('id', invoiceId);

    if (delError) {
      logger.error('Failed to delete invoice from database', delError, { requestId, invoiceId });
      return createApiErrorResponse({
        message: 'Failed to delete invoice.',
        code: 'DATABASE_DELETE_ERROR',
        status: 500,
        requestId,
      });
    }

    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: existing.workspace_id,
        action: 'deleted_invoice',
        title: `Deleted Invoice #${existing.invoice_number}`,
        description: `Invoice #${existing.invoice_number} was deleted.`,
        resource_type: 'invoice',
        resource_id: invoiceId,
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Invoice deleted successfully.',
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
    logger.error('Unexpected exception during invoice deletion', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error deleting invoice.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
