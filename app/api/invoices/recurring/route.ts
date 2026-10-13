import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateRecurringScheduleSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { computeNextRunAt } from '@/shared/rules/recurring-rules';

/**
 * Recurring Invoice Schedules Collection Route
 *
 * GET  /api/invoices/recurring - Lists all recurring schedules for caller's workspace
 * POST /api/invoices/recurring - Creates a new recurring invoice schedule
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_list',
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
        schedules: [],
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

    const { data: schedules, error: schedError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (schedError) {
      logger.error('Failed to list recurring schedules', schedError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to retrieve recurring schedules.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        schedules: schedules || [],
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
    logger.error('Unexpected error fetching recurring schedules', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_create',
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

  const bodyValidation = await parseJsonBody(request, CreateRecurringScheduleSchema, {
    maxBytes: 50 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // Demo Mode Simulation
  if (isDemoModeActive()) {
    const fakeId = `sched-demo-${Date.now()}`;
    const initialNextRun = computeNextRunAt(
      {
        frequency: payload.frequency,
        intervalDays: payload.intervalDays,
        anchorDate: payload.anchorDate,
        dayOfMonth: payload.dayOfMonth,
        timezone: payload.timezone,
        endsOn: payload.endsOn,
        maxOccurrences: payload.maxOccurrences,
      },
      new Date()
    );

    return NextResponse.json(
      {
        success: true,
        schedule: {
          id: fakeId,
          ...payload,
          status: 'active',
          occurrences_count: 0,
          next_run_at: initialNextRun ? initialNextRun.toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
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

    // Verify client belongs to workspace
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, status')
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

    if (client.status === 'archived' || client.status === 'pending_deletion') {
      return createApiErrorResponse({
        message: 'Cannot create recurring schedule for an archived client.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    // Calculate initial next_run_at
    const initialNextRun = computeNextRunAt(
      {
        frequency: payload.frequency,
        intervalDays: payload.intervalDays,
        anchorDate: payload.anchorDate,
        dayOfMonth: payload.dayOfMonth,
        timezone: payload.timezone,
        endsOn: payload.endsOn,
        maxOccurrences: payload.maxOccurrences,
        occurrencesCount: 0,
      },
      new Date()
    );

    if (!initialNextRun) {
      return createApiErrorResponse({
        message: 'Schedule configuration has no valid future run dates (check endsOn or maxOccurrences).',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    const nowIso = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('recurring_invoice_schedules')
      .insert({
        workspace_id: workspace.id,
        client_id: payload.clientId,
        project_id: payload.projectId || null,
        name: payload.name,
        status: 'active',
        frequency: payload.frequency,
        interval_days: payload.intervalDays || null,
        anchor_date: payload.anchorDate,
        day_of_month: payload.dayOfMonth || null,
        timezone: payload.timezone || 'UTC',
        next_run_at: initialNextRun.toISOString(),
        ends_on: payload.endsOn || null,
        max_occurrences: payload.maxOccurrences || null,
        occurrences_count: 0,
        auto_send: payload.autoSend ?? false,
        due_in_days: payload.dueInDays ?? 14,
        currency: payload.currency || 'USD',
        template: payload.template,
        created_by: caller.userId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      logger.error('Failed to insert recurring schedule', insertError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to create recurring invoice schedule.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    logger.security('RECURRING_SCHEDULE_CREATED', {
      requestId,
      status: 'SUCCESS',
      scheduleId: inserted.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json(
      {
        success: true,
        schedule: inserted,
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
    logger.error('Unexpected error creating recurring schedule', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
