import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, PreviewRecurringScheduleSchema } from '@/shared/validation';
import { projectUpcomingOccurrences } from '@/shared/rules/recurring-rules';

/**
 * Preview Recurring Schedule Occurrences Route
 *
 * POST /api/invoices/recurring/preview
 * Returns projected upcoming run dates and period keys without mutating data.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'recurring_sched_preview',
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

  const bodyValidation = await parseJsonBody(request, PreviewRecurringScheduleSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  const occurrences = projectUpcomingOccurrences(
    {
      frequency: payload.frequency,
      intervalDays: payload.intervalDays,
      anchorDate: payload.anchorDate,
      dayOfMonth: payload.dayOfMonth,
      timezone: payload.timezone,
      endsOn: payload.endsOn,
      maxOccurrences: payload.maxOccurrences,
      occurrencesCount: payload.occurrencesCount ?? 0,
    },
    payload.count ?? 3,
    new Date()
  );

  return NextResponse.json(
    {
      success: true,
      occurrences: occurrences.map((occ) => ({
        runAt: occ.runAt.toISOString(),
        periodKey: occ.periodKey,
      })),
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
