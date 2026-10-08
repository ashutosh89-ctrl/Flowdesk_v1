/**
 * Background Job Engine: Types and Interfaces
 */

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface JobRecord<T = Record<string, any>> {
  id: string;
  type: string;
  workspace_id: string;
  payload: T;
  status: JobStatus;
  run_at: string;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_until: string | null;
  last_error: string | null;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface JobRunRecord {
  id: string;
  job_id: string;
  workspace_id: string;
  attempt_number: number;
  status: JobStatus;
  worker_id: string;
  duration_ms: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
}

export interface JobExecutionContext {
  jobId: string;
  workspaceId: string;
  attempt: number;
  maxAttempts: number;
  workerId: string;
  isDryRun: boolean;
}

export type JobHandler<T = any> = (
  payload: T,
  context: JobExecutionContext
) => Promise<{ success: boolean; data?: any; error?: string }>;

export interface EnqueueJobOptions<T = any> {
  type: string;
  workspaceId: string;
  payload: T;
  runAt?: Date | string;
  dedupeKey?: string;
  maxAttempts?: number;
}

export interface RunnerOptions {
  workerId?: string;
  batchSize?: number;
  leaseSeconds?: number;
  timeBudgetMs?: number;
  isDryRun?: boolean;
}

export interface RunnerResult {
  claimed: number;
  succeeded: number;
  failed: number;
  dead: number;
  durationMs: number;
  timedOut: boolean;
  errors: string[];
}

export interface JobHealthStats {
  lastRunnerRunAt: string | null;
  jobsProcessedLast7Days: number;
  failedLast7Days: number;
  deadJobsCount: number;
  recentDeadJobs: {
    id: string;
    type: string;
    lastError: string | null;
    createdAt: string;
    attempts: number;
  }[];
}
