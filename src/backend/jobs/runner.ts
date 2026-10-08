/**
 * Background Job Runner
 *
 * Executes claimed batches with exponential backoff, jitter, serverless time budget,
 * and error redaction.
 */

import crypto from 'crypto';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { jobRegistry } from './registry';
import { JobRecord, RunnerOptions, RunnerResult, JobExecutionContext } from './types';
import { __getInMemoryJobs } from './queue';

/**
 * Sanitizes and redacts sensitive error messages before saving to database.
 */
export function redactErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  let message = typeof error === 'string' ? error : error?.message || String(error);

  // Redact secrets, keys, bearer tokens
  message = message.replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]');
  message = message.replace(/(xkeysib-|rzp_test_|rzp_live_)[A-Za-z0-9_\-]+/gi, '[REDACTED_API_KEY]');
  message = message.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/gi, '[REDACTED_EMAIL]');
  message = message.replace(/(password|secret|token)\s*[:=]\s*[^\s,]+/gi, '$1=[REDACTED]');

  return message.slice(0, 2048);
}

/**
 * Calculates exponential backoff with jitter in milliseconds.
 * delay = min(3600s, 15s * 2^attempts) +/- jitter(0..5s)
 */
export function calculateBackoffMs(attempts: number): number {
  const baseSeconds = Math.min(3600, 15 * Math.pow(2, Math.max(0, attempts - 1)));
  const jitterSeconds = Math.floor(Math.random() * 5);
  return (baseSeconds + jitterSeconds) * 1000;
}

export async function claimAndRunJobs(options: RunnerOptions = {}): Promise<RunnerResult> {
  const {
    workerId = `worker_${process.pid || 1}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    batchSize = 10,
    leaseSeconds = 60,
    timeBudgetMs = 20000, // 20s default execution budget
    isDryRun = false,
  } = options;

  const startTime = Date.now();
  const errors: string[] = [];
  let claimedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let deadCount = 0;
  let timedOut = false;

  // 1. Claim Jobs
  let jobs: JobRecord[] = [];

  if (!supabaseAdmin || isDemoModeActive()) {
    // In-memory test claim
    const inMem = __getInMemoryJobs();
    const now = Date.now();
    for (const job of inMem.values()) {
      if (jobs.length >= batchSize) break;
      const runAtTime = new Date(job.run_at).getTime();
      const leaseExpired = job.locked_until && new Date(job.locked_until).getTime() < now;
      if (
        (job.status === 'queued' && runAtTime <= now) ||
        (job.status === 'running' && leaseExpired)
      ) {
        if (job.attempts < job.max_attempts) {
          job.status = 'running';
          job.locked_by = workerId;
          job.locked_until = new Date(now + leaseSeconds * 1000).toISOString();
          job.attempts += 1;
          jobs.push({ ...job });
        }
      }
    }
  } else {
    try {
      const { data, error } = await supabaseAdmin.rpc('claim_jobs', {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
      });

      if (error) {
        logger.error(`[JobRunner] claim_jobs RPC failed: ${error.message}`, error);
        errors.push(`claim_jobs error: ${error.message}`);
        return {
          claimed: 0,
          succeeded: 0,
          failed: 0,
          dead: 0,
          durationMs: Date.now() - startTime,
          timedOut: false,
          errors,
        };
      }

      jobs = (data as JobRecord[]) || [];
    } catch (rpcErr: any) {
      logger.error(`[JobRunner] Unexpected error claiming jobs: ${rpcErr?.message}`, rpcErr);
      errors.push(`claim error: ${rpcErr?.message}`);
      return {
        claimed: 0,
        succeeded: 0,
        failed: 0,
        dead: 0,
        durationMs: Date.now() - startTime,
        timedOut: false,
        errors,
      };
    }
  }

  claimedCount = jobs.length;

  if (isDryRun || claimedCount === 0) {
    return {
      claimed: claimedCount,
      succeeded: 0,
      failed: 0,
      dead: 0,
      durationMs: Date.now() - startTime,
      timedOut: false,
      errors,
    };
  }

  // 2. Execute Claimed Jobs
  for (const job of jobs) {
    // Check remaining time budget before starting next job
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeBudgetMs) {
      timedOut = true;
      logger.warn(`[JobRunner] Serverless time budget of ${timeBudgetMs}ms reached. Halting batch.`, {
        elapsedMs: elapsed,
        remainingJobs: jobs.length - (succeededCount + failedCount),
      });
      break;
    }

    const jobStartTime = Date.now();
    const handler = jobRegistry.get(job.type);

    const context: JobExecutionContext = {
      jobId: job.id,
      workspaceId: job.workspace_id,
      attempt: job.attempts,
      maxAttempts: job.max_attempts,
      workerId,
      isDryRun,
    };

    if (!handler) {
      const errMsg = `No registered handler for job type: '${job.type}'`;
      logger.error(errMsg, { jobId: job.id, type: job.type });
      errors.push(errMsg);
      await handleJobFailure(job, workerId, Date.now() - jobStartTime, errMsg, true);
      failedCount++;
      deadCount++;
      continue;
    }

    try {
      const result = await handler(job.payload, context);
      const jobDurationMs = Date.now() - jobStartTime;

      if (result.success) {
        await handleJobSuccess(job, workerId, jobDurationMs);
        succeededCount++;
      } else {
        const errMsg = redactErrorMessage(result.error || 'Handler returned failure');
        const isDead = job.attempts >= job.max_attempts;
        await handleJobFailure(job, workerId, jobDurationMs, errMsg, isDead);
        failedCount++;
        if (isDead) deadCount++;
        errors.push(`Job ${job.id} (${job.type}) failed: ${errMsg}`);
      }
    } catch (err: any) {
      const jobDurationMs = Date.now() - jobStartTime;
      const errMsg = redactErrorMessage(err);
      const isDead = job.attempts >= job.max_attempts;
      await handleJobFailure(job, workerId, jobDurationMs, errMsg, isDead);
      failedCount++;
      if (isDead) deadCount++;
      errors.push(`Job ${job.id} (${job.type}) uncaught error: ${errMsg}`);
    }
  }

  return {
    claimed: claimedCount,
    succeeded: succeededCount,
    failed: failedCount,
    dead: deadCount,
    durationMs: Date.now() - startTime,
    timedOut,
    errors,
  };
}

async function handleJobSuccess(job: JobRecord, workerId: string, durationMs: number): Promise<void> {
  if (!supabaseAdmin || isDemoModeActive()) {
    const memJobs = __getInMemoryJobs();
    const existing = memJobs.get(job.id);
    if (existing) {
      existing.status = 'succeeded';
      existing.locked_by = null;
      existing.locked_until = null;
      existing.finished_at = new Date().toISOString();
    }
    return;
  }

  try {
    await supabaseAdmin.rpc('complete_job', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_duration_ms: durationMs,
    });
  } catch (err) {
    logger.error(`[JobRunner] complete_job RPC failed for ${job.id}`, err);
  }
}

async function handleJobFailure(
  job: JobRecord,
  workerId: string,
  durationMs: number,
  errorMessage: string,
  isDead: boolean
): Promise<void> {
  const backoffMs = calculateBackoffMs(job.attempts);
  const nextRunAt = new Date(Date.now() + backoffMs).toISOString();

  if (!supabaseAdmin || isDemoModeActive()) {
    const memJobs = __getInMemoryJobs();
    const existing = memJobs.get(job.id);
    if (existing) {
      existing.status = isDead ? 'dead' : 'queued';
      existing.locked_by = null;
      existing.locked_until = null;
      existing.last_error = errorMessage;
      existing.run_at = isDead ? existing.run_at : nextRunAt;
      existing.finished_at = isDead ? new Date().toISOString() : null;
    }
    return;
  }

  try {
    await supabaseAdmin.rpc('fail_job', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_duration_ms: durationMs,
      p_error_message: errorMessage,
      p_next_run_at: nextRunAt,
      p_dead: isDead,
    });
  } catch (err) {
    logger.error(`[JobRunner] fail_job RPC failed for ${job.id}`, err);
  }
}
