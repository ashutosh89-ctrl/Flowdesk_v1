import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, UpdateRecurringScheduleSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { computeNextRunAt } from '@/shared/rules/recurring-rules';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ scheduleId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_get',
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

  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.scheduleId, uuidSchema, 'scheduleId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const scheduleId = paramValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        schedule: { id: scheduleId, name: 'Demo Schedule', status: 'active' },
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

    const { data: schedule, error: schedError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (schedError || !schedule) {
      return createApiErrorResponse({
        message: 'Recurring schedule not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        schedule,
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
    logger.error('Unexpected error fetching recurring schedule', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ scheduleId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_patch',
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

  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.scheduleId, uuidSchema, 'scheduleId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const scheduleId = paramValidation.data;

  const bodyValidation = await parseJsonBody(request, UpdateRecurringScheduleSchema, {
    maxBytes: 50 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        schedule: { id: scheduleId, ...updates },
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

    const { data: existing, error: findError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (findError || !existing) {
      return createApiErrorResponse({
        message: 'Recurring schedule not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const merged = { ...existing, ...updates };

    // If frequency, anchor, or boundary changed, re-calculate next_run_at
    let nextRunIso = existing.next_run_at;
    if (
      updates.frequency ||
      updates.anchorDate ||
      updates.intervalDays !== undefined ||
      updates.dayOfMonth !== undefined ||
      updates.endsOn !== undefined ||
      updates.maxOccurrences !== undefined
    ) {
      const nextRun = computeNextRunAt(
        {
          frequency: merged.frequency,
          intervalDays: merged.interval_days,
          anchorDate: merged.anchor_date,
          dayOfMonth: merged.day_of_month,
          timezone: merged.timezone,
          endsOn: merged.ends_on,
          maxOccurrences: merged.max_occurrences,
          occurrencesCount: merged.occurrences_count || 0,
        },
        new Date()
      );
      nextRunIso = nextRun ? nextRun.toISOString() : existing.next_run_at;
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
      next_run_at: nextRunIso,
    };

    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.frequency !== undefined) updatePayload.frequency = updates.frequency;
    if (updates.intervalDays !== undefined) updatePayload.interval_days = updates.intervalDays;
    if (updates.anchorDate !== undefined) updatePayload.anchor_date = updates.anchorDate;
    if (updates.dayOfMonth !== undefined) updatePayload.day_of_month = updates.dayOfMonth;
    if (updates.timezone !== undefined) updatePayload.timezone = updates.timezone;
    if (updates.endsOn !== undefined) updatePayload.ends_on = updates.endsOn;
    if (updates.maxOccurrences !== undefined) updatePayload.max_occurrences = updates.maxOccurrences;
    if (updates.autoSend !== undefined) updatePayload.auto_send = updates.autoSend;
    if (updates.dueInDays !== undefined) updatePayload.due_in_days = updates.dueInDays;
    if (updates.currency !== undefined) updatePayload.currency = updates.currency;
    if (updates.template !== undefined) updatePayload.template = updates.template;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .update(updatePayload)
      .eq('id', scheduleId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update recurring schedule', updateError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to update recurring schedule.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        schedule: updated,
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
    logger.error('Unexpected error updating recurring schedule', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
