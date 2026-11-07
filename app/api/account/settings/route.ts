import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, UpdateUserSettingsSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { serverPaymentSettingsCache } from '@/backend/utilities/payment-cache';

/**
 * Account Settings Query Route Handler (Batch 4: Account & Settings)
 *
 * Secure server-side retrieval of user billing, invoice formatting, tax, and payment settings.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_settings_get',
    maxRequests: 60,
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
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to retrieve account settings.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const localProf = FlowDeskStore.getUserProfile() || {};
    return NextResponse.json({
      success: true,
      settings: {
        id: caller.userId || 'usr-demo-freelancer',
        currency: (localProf as any).currency || 'INR',
        default_tax_rate: (localProf as any).defaultTaxRate || 0,
        tax_name: (localProf as any).taxName || 'GST',
        upi_id: (localProf as any).upiId || '',
        upi_qr_code_url: (localProf as any).upiQrCodeUrl || '',
        payment_settings: (localProf as any).paymentMethods || {},
      },
      requestId,
    });
  }

  try {
    let settings: any = null;
    const userId = caller.userId;

    if (!userId) {
      return createApiErrorResponse({
        message: 'Valid user session required.',
        code: 'UNAUTHORIZED',
        status: 401,
        requestId,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      settings = data;
    } else if (!data) {
      // Default empty settings strictly scoped to the authenticated user
      settings = {
        id: userId,
        currency: 'INR',
        default_tax_rate: 0,
        tax_name: 'GST',
        upi_id: '',
        upi_qr_code_url: '',
        payment_settings: {},
      };
    }

    if (settings && userId) {
      let cached = serverPaymentSettingsCache.get(userId);
      if (!cached) {
        try {
          const { data: fileData, error: fileErr } = await supabaseAdmin.storage
            .from('documents')
            .download(`settings/${userId}/payment_settings.txt`);
          if (!fileErr && fileData) {
            const rawText = await fileData.text();
            cached = JSON.parse(rawText);
            serverPaymentSettingsCache.set(userId, cached);
          }
        } catch {
          // non-critical storage read fallback
        }
      }
      if (cached) {
        settings.payment_settings = {
          ...(cached || {}),
          ...(settings.payment_settings || {}),
        };
        settings.bank_name = settings.bank_name || cached.bankDetails?.bankName || '';
        settings.account_holder_name = settings.account_holder_name || cached.bankDetails?.accountHolderName || '';
        settings.account_number = settings.account_number || cached.bankDetails?.accountNumber || '';
        settings.ifsc_code = settings.ifsc_code || cached.bankDetails?.ifscCode || '';
        settings.branch_name = settings.branch_name || cached.bankDetails?.branchName || '';
        settings.upi_id = settings.upi_id || cached.upiId || '';
        settings.upi_qr_code_url = settings.upi_qr_code_url || cached.upiQrCodeUrl || '';
        settings.razorpay_payment_link = settings.razorpay_payment_link || cached.razorpayPaymentLink || '';
      }
    }

    return NextResponse.json(
      {
        success: true,
        settings: settings || null,
        requestId,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Failed to retrieve account settings.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

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
    maxBytes: 2 * 1024 * 1024,
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
    const hasAutoNumberingUpdates =
      updates.invoicePrefix !== undefined ||
      updates.invoiceNumberFormat !== undefined ||
      updates.invoiceSeparator !== undefined ||
      updates.invoiceIncludeYear !== undefined ||
      updates.invoicePadding !== undefined ||
      updates.invoiceNextSequence !== undefined;

    if (hasAutoNumberingUpdates || (updates.currency && updates.currency !== 'INR')) {
      const { assertCan } = await import('@/backend/billing');
      const { PlanLimitError } = await import('@/shared/billing');
      let wsId = caller.workspaceId;
      if (!wsId && caller.userId && supabaseAdmin) {
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('owner_id', caller.userId)
          .limit(1)
          .maybeSingle();
        if (ws?.id) wsId = ws.id;
      }

      if (hasAutoNumberingUpdates) {
        try {
          await assertCan(wsId || caller.userId || '', 'autoNumbering');
        } catch (err: any) {
          if (err instanceof PlanLimitError) {
            return createApiErrorResponse({
              message: 'Custom invoice auto-numbering is available on Standard and Studio plans.',
              code: err.code,
              status: err.statusCode,
              requestId,
            });
          }
          throw err;
        }
      }

      if (updates.currency && updates.currency !== 'INR') {
        try {
          await assertCan(wsId || caller.userId || '', 'multiCurrency');
        } catch (err: any) {
          if (err instanceof PlanLimitError) {
            return createApiErrorResponse({
              message: 'Multi-currency configuration is available on Standard and Studio plans. Starter is limited to INR.',
              code: err.code,
              status: err.statusCode,
              requestId,
            });
          }
          throw err;
        }
      }
    }

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

    // Resolve unified payment details ensuring non-empty bank, UPI, and QR values are preserved
    const inBank = updates.paymentSettings?.bankDetails || {};
    const bankName = (updates.bankName !== undefined ? updates.bankName : inBank.bankName || '')?.trim();
    const accountHolderName = (updates.accountHolderName !== undefined ? updates.accountHolderName : inBank.accountHolderName || '')?.trim();
    const accountNumber = (updates.accountNumber !== undefined ? updates.accountNumber : inBank.accountNumber || '')?.trim();
    const ifscCode = (updates.ifscCode !== undefined ? updates.ifscCode : inBank.ifscCode || '')?.trim();
    const branchName = (updates.branchName !== undefined ? updates.branchName : inBank.branchName || '')?.trim();
    const upiId = (updates.upiId !== undefined ? updates.upiId : (inBank.upiId || updates.paymentSettings?.upiId || ''))?.trim();
    const upiQrCodeUrl = (updates.upiQrCodeUrl !== undefined ? updates.upiQrCodeUrl : (updates.paymentSettings?.upiQrCodeUrl || ''))?.trim();
    const razorpayPaymentLink = (updates.razorpayPaymentLink !== undefined ? updates.razorpayPaymentLink : (updates.paymentSettings?.razorpayPaymentLink || ''))?.trim();

    const hasBank = Boolean(bankName || accountNumber || accountHolderName || ifscCode);
    const hasUpi = Boolean(upiId || upiQrCodeUrl);

    const effectivePaymentSettings: Record<string, any> = {
      ...(updates.paymentSettings || {}),
      bankTransferEnabled: hasBank,
      upiEnabled: hasUpi,
      upiId: upiId || undefined,
      upiQrCodeUrl: upiQrCodeUrl || undefined,
      razorpayPaymentLink: razorpayPaymentLink || undefined,
      ...(hasBank
        ? {
            bankDetails: {
              accountHolderName,
              bankName,
              accountNumber,
              ifscCode,
              branchName,
              upiId,
            },
          }
        : {}),
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

      // 3. If still failing (e.g. payment_settings column also missing from core relational schema),
      // strip payment_settings and retry with core relational columns
      if (upsertErr) {
        delete dbPayload.payment_settings;
        retry = await supabaseAdmin.from('user_settings').upsert(dbPayload).select().maybeSingle();
        updated = retry.data;
        upsertErr = retry.error;
      }
    }

    if (caller.userId) {
      serverPaymentSettingsCache.set(caller.userId, effectivePaymentSettings);
      try {
        const payloadJson = Buffer.from(JSON.stringify(effectivePaymentSettings), 'utf-8');
        await Promise.all([
          supabaseAdmin.storage
            .from('documents')
            .upload(
              `settings/${caller.userId}/payment_settings.txt`,
              payloadJson,
              {
                contentType: 'text/plain',
                upsert: true,
              }
            ),
          supabaseAdmin.storage
            .from('documents')
            .upload(
              'settings/latest/payment_settings.txt',
              payloadJson,
              {
                contentType: 'text/plain',
                upsert: true,
              }
            ),
        ]);
      } catch (storageErr) {
        logger.warn('Storage payment config sync notice', { error: String(storageErr) });
      }

      // Trigger realtime update for client portals by touching workspaces and active invoices
      try {
        const nowIso = new Date().toISOString();
        const { data: userWorkspaces } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('owner_id', caller.userId);

        if (userWorkspaces && userWorkspaces.length > 0) {
          const wsIds = userWorkspaces.map((w) => w.id);
          await Promise.all([
            supabaseAdmin.from('workspaces').update({ updated_at: nowIso }).eq('owner_id', caller.userId),
            supabaseAdmin.from('invoices').update({ updated_at: nowIso }).in('workspace_id', wsIds),
          ]);
        }
      } catch (wsTouchErr) {
        logger.warn('Workspace realtime touch sync notice', { error: String(wsTouchErr) });
      }
    }

    if (updated) {
      updated.payment_settings = effectivePaymentSettings;
      updated.bank_name = bankName || effectivePaymentSettings.bankDetails?.bankName || '';
      updated.account_holder_name = accountHolderName || effectivePaymentSettings.bankDetails?.accountHolderName || '';
      updated.account_number = accountNumber || effectivePaymentSettings.bankDetails?.accountNumber || '';
      updated.ifsc_code = ifscCode || effectivePaymentSettings.bankDetails?.ifscCode || '';
      updated.branch_name = branchName || effectivePaymentSettings.bankDetails?.branchName || '';
      updated.upi_id = upiId || effectivePaymentSettings.upiId || '';
      updated.upi_qr_code_url = upiQrCodeUrl || effectivePaymentSettings.upiQrCodeUrl || '';
      updated.razorpay_payment_link = razorpayPaymentLink || effectivePaymentSettings.razorpayPaymentLink || '';
    }

    // Also sync to profiles for redundant persistence
    if (caller.userId) {
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
