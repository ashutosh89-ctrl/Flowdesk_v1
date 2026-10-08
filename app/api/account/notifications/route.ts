import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, UpdateNotificationSettingsSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Notification Settings Mutation Route Handler (Batch 4: Account & Settings)
 *
 * Secure server-side updates of user notification and email preferences.
 * - Restricted strictly to the authenticated user derived from session.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_notifications_update',
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
      message: 'Authentication required to update notification preferences.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, UpdateNotificationSettingsSchema, {
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
        message: 'Notification settings updated successfully (demo mode).',
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

    if (updates.emailNotifications !== undefined) dbPayload.email_notifications = updates.emailNotifications;
    if (updates.emailDeliverables !== undefined) dbPayload.email_deliverables = updates.emailDeliverables;
    if (updates.emailDocuments !== undefined) dbPayload.email_documents = updates.emailDocuments;
    if (updates.emailInvoices !== undefined) dbPayload.email_invoices = updates.emailInvoices;
    if (updates.invoiceReminders !== undefined) dbPayload.invoice_reminders = updates.invoiceReminders;
    if (updates.commentAlerts !== undefined) dbPayload.comment_alerts = updates.commentAlerts;
    if (updates.weeklyDigest !== undefined) dbPayload.weekly_digest = updates.weeklyDigest;

    const { data: updated, error: upsertErr } = await supabaseAdmin
      .from('user_settings')
      .upsert(dbPayload)
      .select()
      .single();

    if (upsertErr || !updated) {
      logger.error('Failed to upsert notification settings in database', upsertErr, {
        requestId,
        userId: caller.userId,
      });
      return createApiErrorResponse({
        message: 'Failed to update notification settings.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    logger.security('NOTIFICATION_SETTINGS_UPDATED', {
      requestId,
      status: 'SUCCESS',
      userId: caller.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Notification settings updated successfully.',
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
    logger.error('Unexpected exception updating notification settings', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error updating notification settings.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
