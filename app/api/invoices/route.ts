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
    let workspaceId = caller.workspaceId;

    if (!workspaceId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();

      if (!ws) {
        return createApiErrorResponse({
          message: 'No active workspace found for this account.',
          code: 'FORBIDDEN',
          status: 403,
          requestId,
        });
      }
      workspaceId = ws.id;
    }

    const effectiveWorkspaceId: string = workspaceId!;

    // 6. Verify Client Affiliation (Strict Workspace Ownership - IDOR Protection)
    let { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, workspace_id, user_id')
      .eq('id', payload.clientId)
      .eq('workspace_id', effectiveWorkspaceId)
      .maybeSingle();

    if (!client) {
      // Also check if clientId was passed as portal_token or email within caller's workspace
      const { data: altClient } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, workspace_id, user_id')
        .eq('workspace_id', effectiveWorkspaceId)
        .or(`portal_token.eq.${payload.clientId},email.eq.${payload.clientId}`)
        .maybeSingle();
      client = altClient;
    }

    if (!client) {
      return createApiErrorResponse({
        message: 'Client not found in your workspace.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const targetWorkspaceId = effectiveWorkspaceId;

    // 6a. Quota Enforcement: Verify within plan limit for invoices per month (cached)
    try {
      await assertWithinLimit(targetWorkspaceId, 'invoicesPerMonth', 1);
    } catch (limitErr: any) {
      if (limitErr instanceof PlanLimitError) {
        return createApiErrorResponse({
          message: limitErr.message,
          code: limitErr.code,
          status: limitErr.statusCode,
          requestId,
          metric: limitErr.metric || 'invoicesPerMonth',
          currentPlan: limitErr.currentPlan,
          currentUsage: limitErr.current,
          maxAllowed: limitErr.limit,
          recommendedPlan: limitErr.recommendedPlan,
        });
      }
      throw limitErr;
    }

    // 6b. Feature Enforcement: Multi-Currency Invoicing
    // Starter tier is restricted to base INR currency; Standard and Studio support multi-currency
    const reqCurrency = (payload.currency || 'INR').toUpperCase().trim();
    if (reqCurrency !== 'INR') {
      try {
        const { assertCan } = await import('@/backend/billing');
        await assertCan(targetWorkspaceId, 'multiCurrency');
      } catch (curErr: any) {
        if (curErr instanceof PlanLimitError) {
          return createApiErrorResponse({
            message: `Multi-currency invoicing (${reqCurrency}) requires a Standard or Studio subscription. Free Starter is limited to INR.`,
            code: curErr.code,
            status: curErr.statusCode,
            requestId,
          });
        }
        throw curErr;
      }
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
        .eq('workspace_id', targetWorkspaceId);

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

    // Query default settings for payment methods and QR code fallback if not explicitly provided
    let defaultQrUrl: string | null = null;
    let defaultUpiId: string | null = null;
    let defaultBankDetails: any = null;
    let defaultRazorpayLink: string | null = null;
    let userSettingsData: any = null;
    let profileData: any = null;

    if (caller.userId) {
      try {
        let { data: userSettings } = await supabaseAdmin
          .from('user_settings')
          .select('*')
          .eq('id', caller.userId)
          .maybeSingle();

        if (!userSettings) {
          const { data: latestSettings } = await supabaseAdmin
            .from('user_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestSettings) {
            userSettings = latestSettings;
          }
        }

        userSettingsData = userSettings;

        if (userSettings) {
          defaultQrUrl = userSettings.upi_qr_code_url || userSettings.payment_settings?.upiQrCodeUrl || null;
          defaultUpiId = userSettings.upi_id || userSettings.payment_settings?.upiId || null;
          defaultBankDetails = userSettings.payment_settings?.bankDetails || (userSettings.bank_name ? {
            bankName: userSettings.bank_name,
            accountHolderName: userSettings.account_holder_name || '',
            accountNumber: userSettings.account_number || '',
            ifscCode: userSettings.ifsc_code || '',
            branchName: userSettings.branch_name || '',
            upiId: defaultUpiId,
          } : null);
          defaultRazorpayLink = userSettings.razorpay_payment_link || userSettings.payment_settings?.razorpayPaymentLink || null;
        }

        if (!defaultQrUrl || !defaultUpiId) {
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', caller.userId)
            .maybeSingle();
          if (prof) {
            profileData = prof;
            if (!defaultQrUrl && prof.upi_qr_code_url) defaultQrUrl = prof.upi_qr_code_url;
            if (!defaultUpiId && prof.upi_id) defaultUpiId = prof.upi_id;
          }
        }
      } catch {
        // non-critical
      }
    }

    const finalQrCodeUrl = payload.upiQrCodeUrl || defaultQrUrl;
    const finalUpiId = payload.upiId || defaultUpiId;
    const finalBankDetails = payload.bankDetails || defaultBankDetails;
    const finalRazorpayLink = payload.razorpayPaymentLink || defaultRazorpayLink;

    // 9. Insert Invoice Record
    const nowIso = new Date().toISOString();
    const isSent = payload.workflowStatus === 'sent' || payload.status === 'sent';
    const userTz = userSettingsData?.timezone || 'Asia/Kolkata';

    let effectiveIssueDate = payload.issueDate;
    if (!effectiveIssueDate) {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: userTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        effectiveIssueDate = formatter.format(new Date());
      } catch {
        effectiveIssueDate = new Date().toISOString().split('T')[0];
      }
    }

    // Prepare human-readable payment instructions if bank or UPI is present
    let formattedInstructions = payload.paymentInstructions || '';
    if (!formattedInstructions) {
      const parts: string[] = [];
      if (finalUpiId) parts.push(`UPI ID: ${finalUpiId}`);
      if (finalBankDetails?.accountNumber) {
        parts.push(`Bank: ${finalBankDetails.bankName || 'Direct Transfer'} | A/C: ${finalBankDetails.accountNumber} | IFSC: ${finalBankDetails.ifscCode || ''}`);
      }
      if (parts.length > 0) formattedInstructions = parts.join(' | ');
    }

    // Embed payment methods metadata inside internal_notes for seamless schema compatibility
    const paymentMethodsMeta = {
      ...(payload.paymentMethods || {
        bankTransferEnabled: true,
        upiEnabled: Boolean(finalUpiId || finalQrCodeUrl),
        razorpayLinkEnabled: Boolean(finalRazorpayLink),
      }),
      upiQrCodeUrl: finalQrCodeUrl || undefined,
      upiId: finalUpiId || undefined,
      bankDetails: finalBankDetails || undefined,
      razorpayPaymentLink: finalRazorpayLink || undefined,
      defaultPaymentInstructions: formattedInstructions || undefined,
    };

    const userInternalNotes = payload.internalNotes || '';
    const encodedInternalNotes = `[PAYMENT_METHODS]: ${JSON.stringify(paymentMethodsMeta)}${userInternalNotes ? '\n' + userInternalNotes : ''}`;

    // Target ONLY verified relational columns on public.invoices table
    const primaryPayload: Record<string, any> = {
      workspace_id: targetWorkspaceId,
      client_id: client.id,
      user_id: caller.userId,
      client_name: client.name || 'Client',
      client_email: client.email || 'client@example.com',
      project_id: payload.projectId || null,
      invoice_number: invoiceNumber,
      status: isSent ? 'sent' : 'draft',
      workflow_status: isSent ? 'sent' : 'draft',
      payment_status: 'pending',
      issue_date: effectiveIssueDate,
      due_date: payload.dueDate,
      subtotal: calc.subtotal,
      tax_percentage: calc.taxPercentage,
      tax_name: payload.taxName || 'GST',
      tax_amount: calc.taxAmount,
      total_amount: calc.total,
      discount: calc.discount,
      paid_amount: 0,
      currency: payload.currency || 'INR',
      notes: payload.notes || '',
      payment_instructions: formattedInstructions,
      internal_notes: encodedInternalNotes,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let insertedInvoice: any = null;
    let insertError: any = null;

    const primaryAttempt = await supabaseAdmin
      .from('invoices')
      .insert(primaryPayload)
      .select()
      .single();

    if (!primaryAttempt.error && primaryAttempt.data) {
      insertedInvoice = primaryAttempt.data;
    } else {
      insertError = primaryAttempt.error;
      logger.warn('Initial invoice insert failed, attempting safe schema fallback retry:', {
        requestId,
        error: insertError?.message,
      });

      // Retry without internal_notes or tax_name if schema variant
      const fallbackPayload: Record<string, any> = {
        workspace_id: targetWorkspaceId,
        client_id: client.id,
        user_id: caller.userId,
        client_name: client.name || 'Client',
        client_email: client.email || 'client@example.com',
        project_id: payload.projectId || null,
        invoice_number: invoiceNumber,
        status: isSent ? 'sent' : 'draft',
        workflow_status: isSent ? 'sent' : 'draft',
        payment_status: 'pending',
        issue_date: effectiveIssueDate,
        due_date: payload.dueDate,
        subtotal: calc.subtotal,
        tax_percentage: calc.taxPercentage,
        tax_amount: calc.taxAmount,
        total_amount: calc.total,
        discount: calc.discount,
        paid_amount: 0,
        currency: payload.currency || 'INR',
        notes: payload.notes || '',
        created_at: nowIso,
        updated_at: nowIso,
      };

      const fallbackAttempt = await supabaseAdmin
        .from('invoices')
        .insert(fallbackPayload)
        .select()
        .single();

      if (!fallbackAttempt.error && fallbackAttempt.data) {
        insertedInvoice = fallbackAttempt.data;
        insertError = null;
      } else {
        insertError = fallbackAttempt.error || insertError;
      }
    }

    if (insertError || !insertedInvoice) {
      logger.error('Failed to insert invoice into database', insertError, { requestId });
      return createApiErrorResponse({
        message: insertError?.code === '23505'
          ? 'An invoice with this number already exists.'
          : (insertError?.message || 'Failed to create invoice.'),
        code: insertError?.code === '23505' ? 'DUPLICATE_INVOICE_NUMBER' : 'DATABASE_INSERT_ERROR',
        status: 400,
        requestId,
      });
    }

    // Invalidate workspace entitlement cache so invoice counts are fresh immediately
    const { invalidateWorkspaceEntitlements } = await import('@/backend/billing/entitlements');
    invalidateWorkspaceEntitlements(targetWorkspaceId);

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

    // 10a. Send email and create notifications if issued directly
    if (isSent) {
      try {
        const { getAppBaseUrl } = await import('@/shared/utils/url');
        const { EmailService } = await import('@/backend/email/email-service');
        const studioName = userSettingsData?.studio_name || userSettingsData?.business_name || profileData?.business_name || profileData?.full_name || 'FlowDesk Studio';
        const portalUrl = `${getAppBaseUrl()}/portal/${client.id}`;
        const currencySymbol = payload.currency || 'INR';

        if (client.email) {
          EmailService.sendInvoiceIssued(
            client.email,
            {
              clientName: client.name || 'Client',
              freelancerName: profileData?.full_name || 'Your Freelancer',
              businessName: studioName,
              invoiceNumber,
              amount: `${currencySymbol} ${calc.total.toLocaleString()}`,
              amountFormatted: `${currencySymbol} ${calc.total.toLocaleString()}`,
              dueDate: payload.dueDate,
              portalUrl,
            },
            {
              workspaceId: targetWorkspaceId,
              invoiceId: insertedInvoice.id,
            }
          ).catch((e: any) => logger.warn('Invoice issued email delivery failed:', { error: e?.message }));
        }

        // Insert notification into notifications table for the client
        await supabaseAdmin.from('notifications').insert({
          workspace_id: targetWorkspaceId,
          client_id: client.id,
          user_id: client.user_id || null,
          title: `New Invoice Issued: #${invoiceNumber}`,
          message: `An invoice #${invoiceNumber} for ${payload.currency || 'INR'} ${calc.total.toLocaleString()} has been issued and is available for payment.`,
          category: 'invoice',
          link: 'invoices',
          priority: 'high',
          read: false,
        });

        // Insert notification for freelancer in notifications table
        await supabaseAdmin.from('notifications').insert({
          workspace_id: targetWorkspaceId,
          client_id: client.id,
          user_id: caller.userId,
          title: `Invoice #${invoiceNumber} Issued`,
          message: `Invoice #${invoiceNumber} for ${client.name} has been issued and sent.`,
          category: 'invoice',
          link: 'invoices',
          priority: 'medium',
          read: false,
        });
      } catch (postErr: any) {
        logger.warn('Failed to dispatch invoice notifications/email:', { error: postErr?.message });
      }
    }

    // 11. Activity Log (NON-BLOCKING)
    (async () => {
      try {
        await supabaseAdmin.from('activities').insert({
          workspace_id: targetWorkspaceId,
          client_id: client.id,
          action: 'created_invoice',
          title: `Created Invoice #${invoiceNumber}`,
          description: `Created invoice #${invoiceNumber} for ${client.name}`,
          resource_type: 'invoice',
          resource_id: insertedInvoice.id,
        });
      } catch { /* non-critical */ }
    })();

    logger.security('INVOICE_CREATED', {
      requestId,
      status: 'SUCCESS',
      invoiceId: insertedInvoice.id,
      invoiceNumber,
      total: calc.total,
      workspaceId,
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
