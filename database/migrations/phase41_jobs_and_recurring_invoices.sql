-- ==============================================================================
-- PHASE 41: FLOWDESK BACKGROUND JOBS, RECURRING INVOICES & AUTOMATED REMINDERS
-- ==============================================================================
-- Description:
--   Implements tables, constraints, indexes, RLS policies, and Postgres RPC
--   claiming functions for the background job runner, recurring invoice engine,
--   and automated invoice payment reminders.
--
-- Tables created/modified:
--   1. public.jobs
--   2. public.job_runs
--   3. public.recurring_invoice_schedules
--   4. public.invoices (added recurring_schedule_id, recurrence_period_key)
--   5. public.reminder_settings
--   6. public.reminder_log
--
-- Safety & Boundaries:
--   - Read-only for authenticated workspace owners on their own workspace records.
--   - Zero client-side INSERT/UPDATE/DELETE. Server writes only via admin/service_role client.
--   - Client portal users (clients table) have NO access to schedules, jobs, or reminder logs.
--   - Postgres RPC functions are SECURITY DEFINER with fixed search_path,
--     revoked from public/anon/authenticated and granted strictly to service_role.
-- ==============================================================================

-- ==============================================================================
-- 1. BACKGROUND JOBS & JOB RUNS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  locked_by TEXT NULL,
  locked_until TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  dedupe_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT jobs_workspace_dedupe_key_unique UNIQUE (workspace_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
  worker_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Job Runner Performance & RLS
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_id ON public.jobs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON public.jobs (status, run_at) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_jobs_locked_until ON public.jobs (locked_until) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON public.job_runs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_workspace_id ON public.job_runs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_completed_at ON public.job_runs (completed_at DESC);

-- ==============================================================================
-- 2. RECURRING INVOICE SCHEDULES & INVOICE RECURRENCE FIELDS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  interval_days INTEGER NULL,
  anchor_date DATE NOT NULL,
  day_of_month INTEGER NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ NULL,
  ends_on DATE NULL,
  max_occurrences INTEGER NULL,
  occurrences_count INTEGER NOT NULL DEFAULT 0,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  due_in_days INTEGER NOT NULL DEFAULT 14,
  currency TEXT NOT NULL DEFAULT 'USD',
  template JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_recurring_template_size CHECK (pg_column_size(template) <= 65536)
);

-- Add Recurrence Linkage to Invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID NULL REFERENCES public.recurring_invoice_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_period_key TEXT NULL;

-- Strict Partial Unique Index: Exactly one invoice per schedule period
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_recurring_period_unique
  ON public.invoices (recurring_schedule_id, recurrence_period_key)
  WHERE recurring_schedule_id IS NOT NULL AND recurrence_period_key IS NOT NULL;

-- Indexes for Schedule Sweeping & Filtering
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_workspace_id ON public.recurring_invoice_schedules (workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_client_id ON public.recurring_invoice_schedules (client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_due ON public.recurring_invoice_schedules (status, next_run_at) WHERE status = 'active';

-- ==============================================================================
-- 3. REMINDER SETTINGS & REMINDER AUDIT LOG
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reminder_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  send_before_due BOOLEAN NOT NULL DEFAULT true,
  days_before_due INTEGER NOT NULL DEFAULT 3,
  send_on_due_date BOOLEAN NOT NULL DEFAULT true,
  send_after_due BOOLEAN NOT NULL DEFAULT true,
  days_after_due INTEGER[] NOT NULL DEFAULT '{3, 7, 14}',
  max_reminders_per_invoice INTEGER NOT NULL DEFAULT 5,
  quiet_hours_start TIME NOT NULL DEFAULT '20:00',
  quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  weekdays_only BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  email_event_id UUID NULL REFERENCES public.email_events(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reminder_log_invoice_rule_unique UNIQUE (invoice_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_workspace_id ON public.reminder_log (workspace_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_invoice_id ON public.reminder_log (invoice_id);

-- ==============================================================================
-- 4. POSTGRES FUNCTIONS (CLAIM, COMPLETE, FAIL JOBS)
-- ==============================================================================

-- Function: claim_jobs(p_worker_id, p_batch_size, p_lease_seconds)
-- Atomically claims runnable jobs using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_jobs(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_lease_until TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::interval;
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT j.id
    FROM public.jobs j
    WHERE (
      (j.status = 'queued' AND j.run_at <= v_now)
      OR
      (j.status = 'running' AND j.locked_until < v_now) -- reclaim expired lease
    )
    AND j.attempts < j.max_attempts
    ORDER BY j.run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.jobs j
  SET
    status = 'running',
    locked_by = p_worker_id,
    locked_until = v_lease_until,
    attempts = j.attempts + 1,
    updated_at = v_now
  FROM claimable c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

-- Function: complete_job(p_job_id, p_worker_id, p_duration_ms)
-- Records successful job execution and appends a job_runs entry
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_duration_ms INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_job public.jobs%ROWTYPE;
BEGIN
  UPDATE public.jobs
  SET
    status = 'succeeded',
    locked_by = NULL,
    locked_until = NULL,
    finished_at = v_now,
    updated_at = v_now
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF FOUND THEN
    INSERT INTO public.job_runs (
      job_id,
      workspace_id,
      attempt_number,
      status,
      worker_id,
      duration_ms,
      started_at,
      completed_at
    ) VALUES (
      p_job_id,
      v_job.workspace_id,
      v_job.attempts,
      'succeeded',
      p_worker_id,
      p_duration_ms,
      v_now - (p_duration_ms || ' milliseconds')::interval,
      v_now
    );
  END IF;
END;
$$;

-- Function: fail_job(p_job_id, p_worker_id, p_duration_ms, p_error_message, p_next_run_at, p_dead)
-- Records failed job execution, schedules retry or moves to dead letter queue
CREATE OR REPLACE FUNCTION public.fail_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_duration_ms INTEGER,
  p_error_message TEXT,
  p_next_run_at TIMESTAMPTZ,
  p_dead BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_job public.jobs%ROWTYPE;
  v_new_status TEXT := CASE WHEN p_dead THEN 'dead' ELSE 'queued' END;
BEGIN
  UPDATE public.jobs
  SET
    status = v_new_status,
    locked_by = NULL,
    locked_until = NULL,
    last_error = LEFT(p_error_message, 2048),
    run_at = CASE WHEN p_dead THEN run_at ELSE p_next_run_at END,
    finished_at = CASE WHEN p_dead THEN v_now ELSE NULL END,
    updated_at = v_now
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF FOUND THEN
    INSERT INTO public.job_runs (
      job_id,
      workspace_id,
      attempt_number,
      status,
      worker_id,
      duration_ms,
      error_message,
      started_at,
      completed_at
    ) VALUES (
      p_job_id,
      v_job.workspace_id,
      v_job.attempts,
      CASE WHEN p_dead THEN 'dead' ELSE 'failed' END,
      p_worker_id,
      p_duration_ms,
      LEFT(p_error_message, 2048),
      v_now - (p_duration_ms || ' milliseconds')::interval,
      v_now
    );
  END IF;
END;
$$;

-- Revoke functions from public/anon/authenticated and grant strictly to service_role
REVOKE ALL ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_job(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Workspace Owner READ-ONLY access to Jobs
DROP POLICY IF EXISTS "jobs_owner_read" ON public.jobs;
CREATE POLICY "jobs_owner_read" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = jobs.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Workspace Owner READ-ONLY access to Job Runs
DROP POLICY IF EXISTS "job_runs_owner_read" ON public.job_runs;
CREATE POLICY "job_runs_owner_read" ON public.job_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = job_runs.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Workspace Owner READ-ONLY access to Recurring Invoice Schedules
DROP POLICY IF EXISTS "recurring_schedules_owner_read" ON public.recurring_invoice_schedules;
CREATE POLICY "recurring_schedules_owner_read" ON public.recurring_invoice_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = recurring_invoice_schedules.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Workspace Owner READ-ONLY access to Reminder Settings
DROP POLICY IF EXISTS "reminder_settings_owner_read" ON public.reminder_settings;
CREATE POLICY "reminder_settings_owner_read" ON public.reminder_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = reminder_settings.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Workspace Owner READ-ONLY access to Reminder Log
DROP POLICY IF EXISTS "reminder_log_owner_read" ON public.reminder_log;
CREATE POLICY "reminder_log_owner_read" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = reminder_log.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- STRICT WRITE DENIAL:
-- No INSERT, UPDATE, or DELETE policies are granted to 'authenticated' or 'anon'
-- on any job, schedule, or reminder table. All mutations are performed via
-- authenticated Next.js server route handlers using the supabaseAdmin client.
-- Client portal users (clients table) have NO access to any of these tables.
