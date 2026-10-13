import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { validateRouteParam, uuidSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { retryJob } from '@/backend/jobs';

/**
 * Retry Dead Job Route
 *
 * POST /api/jobs/[jobId]/retry
 * Resets a dead job owned by the caller's workspace back to queued status.
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'job_retry_post',
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
  const paramValidation = validateRouteParam(rawParams.jobId, uuidSchema, 'jobId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const jobId = paramValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Job reset to queued status (demo mode).',
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

    const result = await retryJob(jobId, workspace.id);

    if (!result.success) {
      return createApiErrorResponse({
        message: result.error || 'Failed to retry job or job is not dead.',
        code: 'JOB_RETRY_FAILED',
        status: 400,
        requestId,
      });
    }

    logger.security('DEAD_JOB_RETRIED_BY_OWNER', {
      requestId,
      status: 'SUCCESS',
      jobId,
      workspaceId: workspace.id,
      userId: caller.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Job has been reset to queued status.',
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
    logger.error('Unexpected error retrying dead job', err, { requestId });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
