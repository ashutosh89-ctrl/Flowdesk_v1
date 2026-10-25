import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, UpdateUserSettingsSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Account Settings Mutation Route Handler (Batch 4: Account & Settings)
 *
 * Secure server-side updates of user billing, invoice formatting, and localization settings.
 * - Restricted strictly to the authenticated user derived from session.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_settings_update',
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
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to update account settings.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, UpdateUserSettingsSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Settings updated successfully (demo mode).',
        settings: {
          id: caller.userId || 'usr-demo-freelancer',
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

  // 5. Production DB Execution & Upsert
  try {
    const dbPayload: Record<string, any> = {
      id: caller.userId,
      updated_at: new Date().toISOString(),
    };

    if (updates.currency !== undefined) dbPayload.currency = updates.currency;
    if (updates.timezone !== undefined) dbPayload.timezone = updates.timezone;
    if (updates.dateFormat !== undefined) dbPayload.date_format = updates.dateFormat;
    if (updates.invoicePrefix !== undefined) dbPayload.invoice_prefix = updates.invoicePrefix;
    if (updates.invoiceNumberFormat !== undefined) dbPayload.invoice_number_format = updates.invoiceNumberFormat;
    if (updates.invoiceSeparator !== undefined) dbPayload.invoice_separator = updates.invoiceSeparator;
    if (updates.invoiceIncludeYear !== undefined) dbPayload.invoice_include_year = updates.invoiceIncludeYear;
    if (updates.invoicePadding !== undefined) dbPayload.invoice_padding = updates.invoicePadding;
    if (updates.invoiceNextSequence !== undefined) dbPayload.invoice_next_sequence = updates.invoiceNextSequence;
    if (updates.defaultTaxRate !== undefined) dbPayload.default_tax_rate = updates.defaultTaxRate;
    if (updates.taxName !== undefined) dbPayload.tax_name = updates.taxName;
    if (updates.defaultPaymentTerms !== undefined) dbPayload.default_payment_terms = updates.defaultPaymentTerms;
    if (updates.defaultDeliverableNiche !== undefined) dbPayload.default_deliverable_niche = updates.defaultDeliverableNiche;
    const effectivePaymentSettings = {
      ...(updates.paymentSettings || {}),
      ...(updates.upiQrCodeUrl !== undefined ? { upiQrCodeUrl: updates.upiQrCodeUrl } : {}),
      ...(updates.upiId !== undefined ? { upiId: updates.upiId } : {}),
      ...((updates.upiQrCodeUrl || updates.upiId) ? { upiEnabled: true } : {}),
      ...(updates.bankName || updates.accountNumber ? {
        bankDetails: {
          accountHolderName: updates.accountHolderName || updates.paymentSettings?.bankDetails?.accountHolderName || '',
          bankName: updates.bankName || updates.paymentSettings?.bankDetails?.bankName || '',
          accountNumber: updates.accountNumber || updates.paymentSettings?.bankDetails?.accountNumber || '',
          ifscCode: updates.ifscCode || updates.paymentSettings?.bankDetails?.ifscCode || '',
          branchName: updates.branchName || updates.paymentSettings?.bankDetails?.branchName || '',
          upiId: updates.upiId || updates.paymentSettings?.bankDetails?.upiId || '',
        }
      } : {}),
      ...(updates.razorpayPaymentLink !== undefined ? { razorpayPaymentLink: updates.razorpayPaymentLink } : {}),
    };
    dbPayload.payment_settings = effectivePaymentSettings;

    if (updates.upiId !== undefined) dbPayload.upi_id = updates.upiId;
    if (updates.upiQrCodeUrl !== undefined) dbPayload.upi_qr_code_url = updates.upiQrCodeUrl;
    if (updates.bankName !== undefined) dbPayload.bank_name = updates.bankName;
    if (updates.accountHolderName !== undefined) dbPayload.account_holder_name = updates.accountHolderName;
    if (updates.accountNumber !== undefined) dbPayload.account_number = updates.accountNumber;
    if (updates.ifscCode !== undefined) dbPayload.ifsc_code = updates.ifscCode;
    if (updates.branchName !== undefined) dbPayload.branch_name = updates.branchName;
    if (updates.razorpayPaymentLink !== undefined) dbPayload.razorpay_payment_link = updates.razorpayPaymentLink;

    let { data: updated, error: upsertErr } = await supabaseAdmin
      .from('user_settings')
      .upsert(dbPayload)
      .select()
      .maybeSingle();

    if (upsertErr) {
      // 1. Retry without default_deliverable_niche
      delete dbPayload.default_deliverable_niche;
      let retry = await supabaseAdmin.from('user_settings').upsert(dbPayload).select().maybeSingle();
      updated = retry.data;
      upsertErr = retry.error;

      // 2. If still failing (e.g. upi_qr_code_url or individual bank columns missing from table),
      // strip individual columns and retry with payment_settings JSONB which preserves all data
      if (upsertErr) {
        delete dbPayload.upi_qr_code_url;
        delete dbPayload.upi_id;
        delete dbPayload.bank_name;
        delete dbPayload.account_holder_name;
        delete dbPayload.account_number;
        delete dbPayload.ifsc_code;
        delete dbPayload.branch_name;
        delete dbPayload.razorpay_payment_link;
        retry = await supabaseAdmin.from('user_settings').upsert(dbPayload).select().maybeSingle();
        updated = retry.data;
        upsertErr = retry.error;
      }
    }

    // Also sync to profiles for redundant persistence
    if (caller.userId && (updates.upiQrCodeUrl !== undefined || updates.upiId !== undefined)) {
      try {
        const profUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.upiQrCodeUrl !== undefined) profUpdates.upi_qr_code_url = updates.upiQrCodeUrl;
        if (updates.upiId !== undefined) profUpdates.upi_id = updates.upiId;
        await supabaseAdmin.from('profiles').update(profUpdates).eq('id', caller.userId);
      } catch {
        // non-critical
      }
    }

    if (upsertErr || !updated) {
      logger.error('Failed to upsert user settings in database', upsertErr, {
        requestId,
        userId: caller.userId,
      });
      return createApiErrorResponse({
        message: 'Failed to update account settings.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    logger.security('ACCOUNT_SETTINGS_UPDATED', {
      requestId,
      status: 'SUCCESS',
      userId: caller.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account settings updated successfully.',
        settings: updated,
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
    logger.error('Unexpected exception updating account settings', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error updating settings.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
