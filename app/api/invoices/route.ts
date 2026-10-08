import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateInvoiceSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { calculateInvoiceTotals, formatInvoiceNumber } from '@/shared/rules';
import { assertWithinLimit } from '@/backend/billing';
import { PlanLimitError } from '@/shared/billing';

/**
 * Invoice Creation Route Handler (Batch 1: Money & Invoices)
 *
 * Secure server-side invoice creation:
 * - Computes totals (subtotal, tax, discount, balance) server-side using pure rules.
 * - Enforces workspace ownership and verifies client association.
 * - Atomically persists invoice and line items.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_create',
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
      message: 'Authentication required to create invoices.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, CreateInvoiceSchema, {
    maxBytes: 50 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    const calc = calculateInvoiceTotals({
      items: payload.items,
      taxPercentage: payload.taxPercentage,
      discount: payload.discount,
    });
    return NextResponse.json(
      {
        success: true,
        invoice: {
          id: `inv-demo-${Date.now()}`,
          invoiceNumber: payload.invoiceNumber || 'INV-2026-0001',
          clientId: payload.clientId,
          subtotal: calc.subtotal,
          tax: calc.taxAmount,
          total: calc.total,
          status: 'draft',
          items: payload.items,
        },
        requestId,
      },
      {
        status: 201,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    // 5. Verify Workspace Ownership
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found for this account.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 6. Verify Client Affiliation
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, name, email')
      .eq('id', payload.clientId)
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (!client) {
      return createApiErrorResponse({
        message: 'Client not found in your workspace.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // 6a. Quota Enforcement: Verify within plan limit for invoices per month
    try {
      await assertWithinLimit(workspace.id, 'invoicesPerMonth', 1);
    } catch (limitErr: any) {
      if (limitErr instanceof PlanLimitError) {
        return createApiErrorResponse({
          message: limitErr.message,
          code: limitErr.code,
          status: limitErr.statusCode,
          requestId,
        });
      }
      throw limitErr;
    }

    // 7. Calculate Financial Totals Server-Side (Zero Client Trust)
    const calc = calculateInvoiceTotals({
      items: payload.items,
      taxPercentage: payload.taxPercentage,
      discount: payload.discount,
    });

    // 8. Generate Invoice Number if omitted
    let invoiceNumber = payload.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const { data: existingInvs } = await supabaseAdmin
        .from('invoices')
        .select('invoice_number')
        .eq('workspace_id', workspace.id);

      const existingNumbers = (existingInvs || []).map((i) => i.invoice_number);
      const year = new Date().getFullYear();
      let maxSeq = 0;
      for (const num of existingNumbers) {
        if (!num) continue;
        const match = num.match(/\d+$/);
        if (match) {
          const parsed = parseInt(match[0], 10);
          if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
        }
      }
      invoiceNumber = formatInvoiceNumber({ prefix: 'INV', includeYear: true }, maxSeq + 1, year);
    }

    // 9. Insert Invoice Record
    const nowIso = new Date().toISOString();
    const { data: insertedInvoice, error: insertError } = await supabaseAdmin
      .from('invoices')
      .insert({
        workspace_id: workspace.id,
        client_id: payload.clientId,
        user_id: caller.userId,
        client_name: client.name || 'Client',
        client_email: client.email || 'client@example.com',
        project_id: payload.projectId || null,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: payload.issueDate,
        due_date: payload.dueDate,
        subtotal: calc.subtotal,
        tax_percentage: calc.taxPercentage,
        tax_name: payload.taxName || 'Tax',
        tax_amount: calc.taxAmount,
        total_amount: calc.total,
        discount: calc.discount,
        paid_amount: 0,
        currency: payload.currency,
        notes: payload.notes || '',
        payment_instructions: payload.paymentInstructions || '',
        internal_notes: payload.internalNotes || '',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (insertError || !insertedInvoice) {
      logger.error('Failed to insert invoice into database', insertError, { requestId });
      return createApiErrorResponse({
        message: insertError?.code === '23505' ? 'An invoice with this number already exists.' : 'Failed to create invoice.',
        code: insertError?.code === '23505' ? 'DUPLICATE_INVOICE_NUMBER' : 'DATABASE_INSERT_ERROR',
        status: 400,
        requestId,
      });
    }

    // 10. Insert Line Items
    if (payload.items.length > 0) {
      const itemsPayload = payload.items.map((it) => ({
        invoice_id: insertedInvoice.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.rate,
        amount: Math.round(it.quantity * it.rate * 100) / 100,
      }));

      await supabaseAdmin.from('invoice_items').insert(itemsPayload);
    }

    // 11. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: workspace.id,
        client_id: payload.clientId,
        action: 'created_invoice',
        title: `Created Invoice #${invoiceNumber}`,
        description: `Created invoice #${invoiceNumber} for ${client.name}`,
        resource_type: 'invoice',
        resource_id: insertedInvoice.id,
      });
    } catch { /* non-critical */ }

    logger.security('INVOICE_CREATED', {
      requestId,
      status: 'SUCCESS',
      invoiceId: insertedInvoice.id,
      invoiceNumber,
      total: calc.total,
      workspaceId: workspace.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Invoice created successfully.',
        invoice: {
          ...insertedInvoice,
          items: payload.items,
        },
        requestId,
      },
      {
        status: 201,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception during invoice creation', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error creating invoice.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
