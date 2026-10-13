import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, UpdateReminderSettingsSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { getWorkspaceEntitlements } from '@/backend/billing';

const DEFAULT_SETTINGS = {
  enabled: true,
  send_before_due: true,
  days_before_due: 3,
  send_on_due_date: true,
  send_after_due: true,
  days_after_due: [3, 7, 14],
  max_reminders_per_invoice: 5,
  quiet_hours_start: '20:00',
  quiet_hours_end: '08:00',
  weekdays_only: true,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'reminder_settings_get',
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
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        settings: { ...DEFAULT_SETTINGS, workspace_id: 'demo-workspace' },
        entitled: true,
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
      .select('id')
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

    // Query entitlements to check if emailReminders is available in plan
    const entitlements = await getWorkspaceEntitlements(workspace.id);
    const entitled = entitlements.limits.emailReminders;

    const { data: settings } = await supabaseAdmin
      .from('reminder_settings')
      .select('*')
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    return NextResponse.json(
      {
        success: true,
        settings: settings || { ...DEFAULT_SETTINGS, workspace_id: workspace.id },
        entitled,
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
    logger.error('Unexpected error fetching reminder settings', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'reminder_settings_patch',
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

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const bodyValidation = await parseJsonBody(request, UpdateReminderSettingsSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        settings: { ...DEFAULT_SETTINGS, ...updates, workspace_id: 'demo-workspace' },
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
      .select('id')
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

    const nowIso = new Date().toISOString();
    const dbPayload: Record<string, any> = {
      workspace_id: workspace.id,
      updated_at: nowIso,
    };

    if (updates.enabled !== undefined) dbPayload.enabled = updates.enabled;
    if (updates.sendBeforeDue !== undefined) dbPayload.send_before_due = updates.sendBeforeDue;
    if (updates.daysBeforeDue !== undefined) dbPayload.days_before_due = updates.daysBeforeDue;
    if (updates.sendOnDueDate !== undefined) dbPayload.send_on_due_date = updates.sendOnDueDate;
    if (updates.sendAfterDue !== undefined) dbPayload.send_after_due = updates.sendAfterDue;
    if (updates.daysAfterDue !== undefined) dbPayload.days_after_due = updates.daysAfterDue;
    if (updates.maxRemindersPerInvoice !== undefined) dbPayload.max_reminders_per_invoice = updates.maxRemindersPerInvoice;
    if (updates.quietHoursStart !== undefined) dbPayload.quiet_hours_start = updates.quietHoursStart;
    if (updates.quietHoursEnd !== undefined) dbPayload.quiet_hours_end = updates.quietHoursEnd;
    if (updates.weekdaysOnly !== undefined) dbPayload.weekdays_only = updates.weekdaysOnly;

    const { data: upserted, error: upsertErr } = await supabaseAdmin
      .from('reminder_settings')
      .upsert(dbPayload, { onConflict: 'workspace_id' })
      .select()
      .single();

    if (upsertErr) {
      logger.error('Failed to update reminder settings', upsertErr, { requestId });
      return createApiErrorResponse({
        message: 'Failed to update reminder settings.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        settings: upserted,
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
    logger.error('Unexpected error updating reminder settings', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
