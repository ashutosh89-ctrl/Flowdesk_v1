import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { validateRouteParam, uuidSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { generatePeriodKey } from '@/shared/rules/recurring-rules';
import { generateRecurringInvoiceHandler } from '@/backend/jobs/handlers/generate-recurring-invoice';

/**
 * Manual Run-Now Trigger for Recurring Invoice Schedule
 *
 * POST /api/invoices/recurring/[scheduleId]/run-now
 * Generates the current period invoice immediately through the exact same
 * idempotent code path as the automated runner.
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scheduleId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_run_now',
    maxRequests: 10,
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
        message: 'Simulated invoice generated for schedule (demo mode).',
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

    // Determine current period key
    const periodKey = generatePeriodKey(
      { frequency: schedule.frequency, dayOfMonth: schedule.day_of_month },
      schedule.next_run_at
    );

    // Execute via standard handler
    const handlerResult = await generateRecurringInvoiceHandler(
      {
        scheduleId: schedule.id,
        periodKey,
      },
      {
        jobId: `manual-run-${Date.now()}`,
        workspaceId: workspace.id,
        attempt: 1,
        maxAttempts: 1,
        workerId: `manual_${caller.userId}`,
        isDryRun: false,
      }
    );

    if (!handlerResult.success) {
      return createApiErrorResponse({
        message: handlerResult.error || 'Failed to generate recurring invoice.',
        code: 'GENERATION_FAILED',
        status: 500,
        requestId,
      });
    }

    logger.security('RECURRING_SCHEDULE_RUN_NOW_EXECUTED', {
      requestId,
      status: 'SUCCESS',
      scheduleId: schedule.id,
      periodKey,
      workspaceId: workspace.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Recurring invoice generation completed successfully.',
        periodKey,
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
    logger.error('Unexpected error running recurring schedule now', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
