/**
 * Background Job Queue
 *
 * Provides enqueue, deduplication, job health queries, and manual retry functions.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { EnqueueJobOptions, JobRecord, JobHealthStats } from './types';

// In-memory job store for unit testing and offline development
const inMemoryJobs = new Map<string, JobRecord>();

export async function enqueueJob<T extends Record<string, any> = Record<string, any>>(
  options: EnqueueJobOptions<T>
): Promise<{ success: boolean; jobId?: string; deduped?: boolean; error?: string }> {
  const { type, workspaceId, payload, runAt, dedupeKey, maxAttempts = 5 } = options;

  const runAtIso = runAt instanceof Date ? runAt.toISOString() : (runAt || new Date().toISOString());
  const nowIso = new Date().toISOString();

  // Offline / Demo / Test harness fallback
  if (!supabaseAdmin || isDemoModeActive()) {
    if (dedupeKey) {
      for (const existing of inMemoryJobs.values()) {
        if (existing.workspace_id === workspaceId && existing.dedupe_key === dedupeKey) {
          return { success: true, jobId: existing.id, deduped: true };
        }
      }
    }
    const id = `job-mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: JobRecord = {
      id,
      type,
      workspace_id: workspaceId,
      payload: payload as Record<string, any>,
      status: 'queued',
      run_at: runAtIso,
      attempts: 0,
      max_attempts: maxAttempts,
      locked_by: null,
      locked_until: null,
      last_error: null,
      dedupe_key: dedupeKey || null,
      created_at: nowIso,
      updated_at: nowIso,
      finished_at: null,
    };
    inMemoryJobs.set(id, record);
    return { success: true, jobId: id, deduped: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert({
        type,
        workspace_id: workspaceId,
        payload,
        status: 'queued',
        run_at: runAtIso,
        max_attempts: maxAttempts,
        dedupe_key: dedupeKey || null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 is PostgreSQL unique_violation code
      if (error.code === '23505') {
        logger.info(`[JobQueue] Job deduplicated: type=${type}, dedupeKey=${dedupeKey}`, {
          workspaceId,
        });
        return { success: true, deduped: true };
      }
      logger.error(`[JobQueue] Failed to enqueue job: ${error.message}`, error, {
        workspaceId,
      });
      return { success: false, error: error.message };
    }

    return { success: true, jobId: data?.id, deduped: false };
  } catch (err: any) {
    logger.error(`[JobQueue] Unexpected error enqueuing job: ${err?.message}`, err, {
      workspaceId,
    });
    return { success: false, error: err?.message || 'Failed to enqueue job' };
  }
}

/**
 * Retrieves aggregate job health statistics and dead jobs for a workspace.
 */
export async function getJobHealth(workspaceId: string): Promise<JobHealthStats> {
  if (!supabaseAdmin || isDemoModeActive()) {
    const memJobs = Array.from(inMemoryJobs.values()).filter((j) => j.workspace_id === workspaceId);
    const dead = memJobs.filter((j) => j.status === 'dead');
    return {
      lastRunnerRunAt: new Date().toISOString(),
      jobsProcessedLast7Days: memJobs.length,
      failedLast7Days: dead.length,
      deadJobsCount: dead.length,
      recentDeadJobs: dead.slice(0, 5).map((d) => ({
        id: d.id,
        type: d.type,
        lastError: d.last_error,
        createdAt: d.created_at,
        attempts: d.attempts,
      })),
    };
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Processed in last 7 days
    const { count: processedCount } = await supabaseAdmin
      .from('job_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('completed_at', sevenDaysAgo);

    // 2. Failed runs in last 7 days
    const { count: failedCount } = await supabaseAdmin
      .from('job_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed')
      .gte('completed_at', sevenDaysAgo);

    // 3. Current dead jobs
    const { data: deadJobs, count: deadCount } = await supabaseAdmin
      .from('jobs')
      .select('id, type, last_error, created_at, attempts')
      .eq('workspace_id', workspaceId)
      .eq('status', 'dead')
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Latest completed job run for workspace
    const { data: latestRun } = await supabaseAdmin
      .from('job_runs')
      .select('completed_at')
      .eq('workspace_id', workspaceId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      lastRunnerRunAt: latestRun?.completed_at || null,
      jobsProcessedLast7Days: processedCount || 0,
      failedLast7Days: failedCount || 0,
      deadJobsCount: deadCount || (deadJobs ? deadJobs.length : 0),
      recentDeadJobs: (deadJobs || []).map((j) => ({
        id: j.id,
        type: j.type,
        lastError: j.last_error,
        createdAt: j.created_at,
        attempts: j.attempts,
      })),
    };
  } catch (err: any) {
    logger.warn(`[JobQueue] Failed to query job health: ${err?.message}`, { workspaceId });
    return {
      lastRunnerRunAt: null,
      jobsProcessedLast7Days: 0,
      failedLast7Days: 0,
      deadJobsCount: 0,
      recentDeadJobs: [],
    };
  }
}

/**
 * Resets a dead job back to queued status for manual re-execution.
 */
export async function retryJob(
  jobId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin || isDemoModeActive()) {
    const job = inMemoryJobs.get(jobId);
    if (job && job.workspace_id === workspaceId) {
      job.status = 'queued';
      job.attempts = 0;
      job.run_at = new Date().toISOString();
      job.last_error = null;
      return { success: true };
    }
    return { success: false, error: 'Job not found in test store' };
  }

  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'queued',
        attempts: 0,
        run_at: nowIso,
        last_error: null,
        updated_at: nowIso,
        finished_at: null,
      })
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'dead');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retry job' };
  }
}

// Helpers for testing harness
export function __getInMemoryJobs(): Map<string, JobRecord> {
  return inMemoryJobs;
}

export function __clearInMemoryJobs(): void {
  inMemoryJobs.clear();
}
