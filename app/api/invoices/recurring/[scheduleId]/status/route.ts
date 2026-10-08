import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, UpdateRecurringScheduleStatusSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { computeNextRunAt } from '@/shared/rules/recurring-rules';

/**
 * Recurring Schedule Status Transition Route
 *
 * POST /api/invoices/recurring/[scheduleId]/status
 * Body: { action: 'pause' | 'resume' | 'cancel' }
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scheduleId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_status',
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

  const bodyValidation = await parseJsonBody(request, UpdateRecurringScheduleStatusSchema, {
    maxBytes: 2 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { action } = bodyValidation.data;

  if (isDemoModeActive()) {
    const targetStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'cancelled';
    return NextResponse.json(
      {
        success: true,
        message: `Schedule status updated to ${targetStatus}`,
        schedule: { id: scheduleId, status: targetStatus },
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

    const { data: schedule, error: fetchError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (fetchError || !schedule) {
      return createApiErrorResponse({
        message: 'Recurring schedule not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    let targetStatus: 'active' | 'paused' | 'cancelled';
    let nextRunIso = schedule.next_run_at;

    if (action === 'pause') {
      targetStatus = 'paused';
    } else if (action === 'cancel') {
      targetStatus = 'cancelled';
    } else if (action === 'resume') {
      targetStatus = 'active';
      // When resuming, ensure next_run_at is strictly in the future
      const nextRun = computeNextRunAt(
        {
          frequency: schedule.frequency,
          intervalDays: schedule.interval_days,
          anchorDate: schedule.anchor_date,
          dayOfMonth: schedule.day_of_month,
          timezone: schedule.timezone,
          endsOn: schedule.ends_on,
          maxOccurrences: schedule.max_occurrences,
          occurrencesCount: schedule.occurrences_count || 0,
        },
        new Date()
      );
      if (nextRun) {
        nextRunIso = nextRun.toISOString();
      }
    } else {
      return createApiErrorResponse({
        message: 'Invalid action.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .update({
        status: targetStatus,
        next_run_at: nextRunIso,
        updated_at: nowIso,
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update schedule status', updateError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to update schedule status.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    logger.security('RECURRING_SCHEDULE_STATUS_CHANGED', {
      requestId,
      status: 'SUCCESS',
      scheduleId,
      oldStatus: schedule.status,
      newStatus: targetStatus,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Schedule status updated to ${targetStatus}`,
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
    logger.error('Unexpected error updating recurring schedule status', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
