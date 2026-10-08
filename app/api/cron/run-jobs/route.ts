import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { runSweeper, claimAndRunJobs } from '@/backend/jobs';

/**
 * Background Job Runner & Automation Sweeper Route Handler
 *
 * Invoked by automated scheduler (Vercel Cron, pg_cron, Upstash QStash, or manual trigger)
 * to sweep due recurring schedules, automated payment reminders, and process queued background jobs.
 *
 * Security controls:
 * - Authentication: Timing-safe Bearer token matched against process.env.CRON_SECRET
 * - Fail closed: Returns 500 CRON_UNCONFIGURED if CRON_SECRET is missing
 * - Rate limiting: 30 requests/min per IP
 * - Dry-run default: Requires ?dry_run=false AND CRON_DRY_RUN !== 'true' to mutate data
 * - Serverless budget: Enforces cooperative time budget
 * - Observability: Reports counts and status only (no PII, no secrets)
 */

function verifyCronSecret(authHeader: string | null, expectedSecret?: string): boolean {
  if (!expectedSecret || typeof expectedSecret !== 'string' || expectedSecret.trim().length === 0) {
    return false;
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

async function executeJobSweepAndRunner(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'cron_run_jobs',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('CRON_JOBS_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Rate limit exceeded for cron run-jobs endpoint',
    });
    return createApiErrorResponse({
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication: Bearer CRON_SECRET verification (Fail-closed)
  const expectedCronSecret = process.env.CRON_SECRET;
  if (!expectedCronSecret) {
    logger.security('CRON_JOBS_UNCONFIGURED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'CRON_SECRET environment variable is not configured',
    });
    return createApiErrorResponse({
      message: 'Cron service is not configured on this server.',
      code: 'CRON_UNCONFIGURED',
      status: 500,
      requestId,
    });
  }

  const authHeader = request.headers.get('authorization');
  if (!verifyCronSecret(authHeader, expectedCronSecret)) {
    logger.security('CRON_JOBS_UNAUTHORIZED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Invalid or missing Authorization Bearer token',
    });
    return createApiErrorResponse({
      message: 'Unauthorized cron invocation.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Dry-Run Default
  const url = new URL(request.url);
  const dryRunParam = url.searchParams.get('dry_run');
  const envDryRun = process.env.CRON_DRY_RUN === 'true';
  const isDryRun = dryRunParam !== 'false' || envDryRun;

  const batchSizeParam = Number(url.searchParams.get('batch_size')) || 10;
  const batchSize = Math.min(50, Math.max(1, batchSizeParam));

  logger.info(`Starting job runner execution (dryRun=${isDryRun}, batchSize=${batchSize})`, {
    requestId,
    ip,
    action: 'cron_run_jobs_start',
  });

  try {
    // 4. Sweeper Step: Find due schedules & reminders, enqueue jobs
    const sweeperSummary = await runSweeper(isDryRun);

    // 5. Worker Runner Step: Claim and run queued jobs
    const runnerResult = await claimAndRunJobs({
      batchSize,
      isDryRun,
      timeBudgetMs: 20000, // 20-second hard serverless budget
    });

    return NextResponse.json(
      {
        success: true,
        dryRun: isDryRun,
        sweeper: {
          dueSchedulesFound: sweeperSummary.dueSchedulesFound,
          scheduleJobsEnqueued: sweeperSummary.scheduleJobsEnqueued,
          dueRemindersFound: sweeperSummary.dueRemindersFound,
          reminderJobsEnqueued: sweeperSummary.reminderJobsEnqueued,
          stalledLeasesReclaimed: sweeperSummary.stalledLeasesReclaimed,
        },
        runner: {
          claimed: runnerResult.claimed,
          succeeded: runnerResult.succeeded,
          failed: runnerResult.failed,
          dead: runnerResult.dead,
          durationMs: runnerResult.durationMs,
          timedOut: runnerResult.timedOut,
        },
        timestamp: new Date().toISOString(),
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
    logger.error('Unexpected error during cron run-jobs sweep/run', err, { requestId });
    return createApiErrorResponse({
      message: 'Job runner sweep encountered an unexpected internal error.',
      code: 'JOB_RUNNER_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return executeJobSweepAndRunner(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return executeJobSweepAndRunner(request);
}
