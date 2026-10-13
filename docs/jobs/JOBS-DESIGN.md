# FlowDesk Background Jobs, Recurring Invoices & Automated Reminders: Architecture & Design

**Author:** Staff Full-Stack Engineer  
**Status:** Approved for Implementation (Phase 7)  
**Target Systems:** Next.js 15 App Router, React 19, TypeScript, Supabase Postgres, Razorpay, Brevo/Resend  
**Security Baseline:** Phases 1–6 complete (Strict RLS, Server Boundaries, Timing-Safe Cron, Entitlements Engine)

---

## 1. Background Job Runner Architecture

### 1.1 Overview & Goals
FlowDesk requires a robust, serverless-friendly asynchronous background job processing engine. The engine must execute recurring billing generation, transactional reminder dispatches, and periodic sweeps without introducing external heavyweight queue clusters (e.g. Redis/Celery/BullMQ) that complicate solo-developer deployments.

Postgres-backed queueing via `SELECT ... FOR UPDATE SKIP LOCKED` provides transactional guarantees, zero extra infrastructure cost, and strict multi-tenant isolation.

```
                  ┌───────────────────────────────────────────────┐
                  │ External Trigger (Vercel Cron / pg_cron)      │
                  │ POST /api/cron/run-jobs?dry_run=false         │
                  │ Headers: Authorization: Bearer <CRON_SECRET>  │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    Cron Route Handler                 │
                      │  - Timing-safe CRON_SECRET auth       │
                      │  - 20s Serverless Execution Budget    │
                      │  - CRON_DRY_RUN mode by default       │
                      └───────┬───────────────────────┬───────┘
                              │                       │
           Step 1: Due Sweeper│                       │Step 2: Worker Engine
                              ▼                       ▼
            ┌───────────────────────────┐   ┌───────────────────────────┐
            │ Sweeper:                  │   │ Runner:                   │
            │ - Find due schedules      │   │ - claim_jobs() via        │
            │ - Enqueue jobs (deduped)  │   │   FOR UPDATE SKIP LOCKED  │
            │ - Find due reminders      │   │ - Execute handler registry│
            │ - Release expired leases  │   │ - Backoff / Dead-letter   │
            └─────────────┬─────────────┘   └─────────────┬─────────────┘
                          │                               │
                          ▼                               ▼
            ┌───────────────────────────────────────────────────────────┐
            │                     Supabase Postgres                     │
            │  - jobs & job_runs tables                                 │
            │  - recurring_invoice_schedules                            │
            │  - invoices (with UNIQUE(schedule_id, period_key))        │
            │  - reminder_settings & reminder_log                       │
            └───────────────────────────────────────────────────────────┘
```

### 1.2 Data Model: `jobs` and `job_runs`

#### `jobs` Table
Stores queued, active, and completed job records.
```sql
CREATE TYPE job_status AS ENUM (
  'queued',
  'running',
  'succeeded',
  'failed',
  'dead'
);

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status job_status NOT NULL DEFAULT 'queued',
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
  CONSTRAINT jobs_dedupe_unique UNIQUE (workspace_id, dedupe_key)
);
```

#### `job_runs` Log Table
Maintains detailed forensic audit trails of individual execution attempts:
```sql
CREATE TABLE public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status job_status NOT NULL,
  worker_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.3 Concurrency & Lease Claiming via Postgres
To prevent dual execution and race conditions across multiple serverless invocations, jobs are claimed in batches using a Postgres function with `FOR UPDATE SKIP LOCKED`:

```sql
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
      (j.status = 'running' AND j.locked_until < v_now) -- crashed worker lease recovery
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
```

**Security Controls:**
- Function is declared `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.
- Execution is `REVOKE ALL FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE TO service_role`.
- RLS: Neither `jobs` nor `job_runs` are queryable by anonymous or client users. Workspace owners have read-only access to their own workspace jobs for health visibility; mutations are strictly server-only.

### 1.4 Retries, Exponential Backoff & Dead-Letter Queue (DLQ)
When a job handler throws an uncaught error:
1. **Redacted Error Capture:** The error message is sanitized (stripping Authorization tokens, API keys, email addresses, and connection strings) before storage.
2. **Backoff Calculation:**
   $$\text{delaySeconds} = \min(3600, 2^{\text{attempts}} \times 15) \pm \text{jitter}(0, 5)$$
3. **Dead-Lettering:** If `attempts >= max_attempts`, the status transitions to `dead`, `finished_at = now()`, and a security/system alert is logged.
4. **Manual Retry:** Freelancers can trigger a manual retry for `dead` jobs owned by their workspace through an authenticated server endpoint, resetting `attempts = 0`, `status = 'queued'`, and `run_at = now()`.

### 1.5 Serverless Time Budget
Serverless environments (Vercel Functions, Supabase Edge Functions) have maximum execution timeouts (15s–60s).
- The FlowDesk runner enforces a **hard per-invocation execution budget** (default: 20 seconds).
- Before claiming a new batch or running the next job, the runner evaluates:
   $$\text{elapsedTime} = \text{Date.now}() - \text{startTime}$$
   If $\text{elapsedTime} \ge 20{,}000\text{ ms}$, the loop terminates gracefully, logging processed counts and leaving remaining jobs in `queued` state for the subsequent cron trigger.

### 1.6 Invocation & Pluggable Schedulers
The runner is triggered via `POST /api/cron/run-jobs`:
- **Authentication:** Timing-safe comparison of `Authorization: Bearer <CRON_SECRET>`. If `CRON_SECRET` is unset, the endpoint fails closed with HTTP 500.
- **Dry-Run Mode:** Defaults to `dry_run=true` unless explicitly invoked with `?dry_run=false` AND `CRON_DRY_RUN !== 'true'`.
- **Swapping Schedulers:**
  * **Option A (Default / Vercel Cron):** `vercel.json` configured with `"crons": [{"path": "/api/cron/run-jobs?dry_run=false", "schedule": "*/10 * * * *"}]`.
  * **Option B (Postgres `pg_cron`):** `SELECT cron.schedule('flowdesk_jobs', '*/5 * * * *', $$SELECT net.http_post(...) $$);`
  * **Option C (Upstash QStash / AWS EventBridge):** HTTP webhook with Bearer token.
  No application code changes are required when switching schedulers because all logic is contained behind the authenticated HTTP route.

---

## 2. Recurring Invoices Engine

### 2.1 Schedule Data Model: `recurring_invoice_schedules`
```sql
CREATE TYPE recurring_frequency AS ENUM (
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom'
);

CREATE TYPE recurring_status AS ENUM (
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TABLE public.recurring_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status recurring_status NOT NULL DEFAULT 'active',
  frequency recurring_frequency NOT NULL,
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
  CONSTRAINT check_template_size CHECK (pg_column_size(template) <= 65536)
);
```

### 2.2 Template Snapshot & Validation
- Recurring invoices do NOT link to a live mutable invoice template. Instead, they store an immutable JSONB snapshot containing:
  * `items`: array of `{ description, quantity, rate }`
  * `taxPercentage`: number (0 to 100)
  * `taxName`: string
  * `discount`: number
  * `notes`: string
  * `paymentInstructions`: string
- Financial calculations never trust client inputs: totals are computed deterministically at generation time using `calculateInvoiceTotals(...)` from `src/shared/rules/invoice-rules.ts`.

### 2.3 Pure Scheduling Rules (`computeNextRunAt` & `periodKey`)
Located in `src/shared/rules/recurring-rules.ts`:
1. **Frequencies:**
   - `weekly`: $+7$ days.
   - `monthly`: $+1$ month, clamping day-of-month to the last valid day of target month (e.g. 31st clamped to 28/29th in Feb, 30th in Apr/Jun/Sep/Nov).
   - `quarterly`: $+3$ months, applying the same month-end clamping.
   - `yearly`: $+1$ year, handling Feb 29 on leap years (clamped to Feb 28 on non-leap years).
   - `custom`: $+ \text{interval\_days}$ days.
2. **Timezone Handling:**
   - The workspace IANA timezone (e.g. `'America/New_York'`, `'Asia/Kolkata'`) determines the start of the calendar day (00:00:00 local time).
   - `next_run_at` is converted and stored as UTC `TIMESTAMPTZ`.
3. **Period Key Generation:**
   - Formatted as `YYYY-MM-DD` representing the recurring billing period.
   - Guaranteed deterministic: `periodKey(schedule, scheduledDate)`.

### 2.4 Idempotency & Database Guarantee
To prevent duplicate invoices under concurrent sweeps or network retries:
```sql
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID NULL REFERENCES public.recurring_invoice_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_period_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_recurring_period_unique
  ON public.invoices (recurring_schedule_id, recurrence_period_key)
  WHERE recurring_schedule_id IS NOT NULL AND recurrence_period_key IS NOT NULL;
```
If two workers execute the generation handler for the same period simultaneously, one succeeds and the other receives a unique constraint violation (`code: '23505'`). The engine catches this error and treats it as a successful no-op.

### 2.5 Catch-Up Policy on System Downtime
If the server or cron was offline across multiple recurring periods:
- **Decision:** **At most ONE invoice is generated** for the most recent due period.
- **Rationale:** Silently backfilling 3 or 6 overdue invoices to a client upon system recovery creates severe client relationship friction and cash-flow confusion.
- **Audit:** Any skipped prior periods are recorded in `job_runs` / schedule notes as `SKIPPED_DUE_TO_DOWNTIME`, and `next_run_at` advances to the next upcoming scheduled date.

### 2.6 Edge Conditions & Safety Checks
Before creating an invoice, `generate_recurring_invoice` verifies:
1. **Schedule Status:** Must be `active`.
2. **Client State:** Client must exist, belong to the workspace, and NOT be archived/deleted. If client is archived, the schedule transitions to `paused` and the owner is notified.
3. **Workspace Entitlements:**
   - Workspace subscription must NOT be in `grace` or `expired` status.
   - If plan monthly invoice quota (`invoicesPerMonth`) is exceeded, generation halts, the job is marked `failed`, and the freelancer is notified to upgrade their plan.

---

## 3. Automated Payment Reminders

### 3.1 Workspace Configuration: `reminder_settings`
Rather than polluting the overloaded `user_settings` table, workspace-scoped reminder policies live in a dedicated table:
```sql
CREATE TABLE public.reminder_settings (
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
```

### 3.2 Reminder Audit Log & Idempotency: `reminder_log`
```sql
CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  email_event_id UUID NULL REFERENCES public.email_events(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reminder_log_invoice_rule_unique UNIQUE (invoice_id, rule_key)
);
```

### 3.3 Rule Decision Engine (`decideReminders`)
Located in `src/shared/rules/reminder-rules.ts`:
```typescript
export interface ReminderDecision {
  shouldSend: boolean;
  ruleKey?: string;
  stage?: 'before_due' | 'due_date' | 'after_due';
  reason?: string;
}
```
**Stop Conditions (Evaluated in strict order):**
1. **Disabled Workspace:** `reminder_settings.enabled === false`.
2. **Plan Entitlement:** Workspace plan does not have `emailReminders: true` entitlement (Free tier is restricted to manual reminders).
3. **Invoice Status:** Status is not `sent` or `viewed` (Drafts and Cancelled invoices are strictly excluded).
4. **Payment Status:** `paid_amount >= total_amount` or remaining balance $\le 0$.
5. **Partial Payments:** If partially paid, only remainder balance is cited.
6. **Client State:** Client is archived or missing email address.
7. **Quiet Hours & Weekdays:** If current workspace local time falls inside quiet hours (e.g. 20:00–08:00) or on weekends when `weekdays_only` is true, the reminder is deferred.
8. **Max Limit:** Total entries in `reminder_log` for the invoice $\ge \text{max\_reminders\_per\_invoice}$.
9. **Rule Deduplication:** `reminder_log` already has a record for `(invoice_id, rule_key)`.

### 3.4 Email Content & Tone per Stage
All transactional reminder emails link to the secure client portal (`/portal/login` or authenticated portal invoice link) and NEVER embed raw bearer tokens or accept client-supplied amounts.
- **Stage 1 (Before Due):** Courteous reminder of upcoming payment date.
- **Stage 2 (Due Date):** Prompt notice that the invoice is due today.
- **Stage 3 (Overdue 3–7 Days):** Polite but firm notification that payment is overdue.
- **Stage 4 (Overdue 14+ Days):** Urgent escalation requesting prompt payment.

Manual "Send Reminder Now" in the UI continues to function, invokes the same server email service, records an entry in `reminder_log` with `rule_key = 'manual'`, and increments the reminder counter.

---

## 4. Failure Handling & Observability

### 4.1 Logging Policies
- **Redaction:** All logs utilize `logger.info` / `logger.error` with `requestId` and `workspaceId`.
- **Zero Secret/PII Leakage:** Recipient emails, tokens, and bank details are never written to job payloads or error logs. Only counts, durations, and entity UUIDs are logged.

### 4.2 In-App "Automations" Health Panel
A dedicated UI component in Freelancer Settings > Automations provides:
1. **Runner Status:** Timestamp of last cron execution and health indicator (Active / Idle / Stalled).
2. **7-Day Statistics:** Total jobs processed, success rate, and failed job count.
3. **Dead Jobs DLQ View:** Scoped to the workspace with:
   - Job type & creation timestamp.
   - Redacted error description.
   - One-click "Retry Job" button.

### 4.3 Stalled Job Recovery
If a serverless worker crashes mid-execution (lambda timeout or OOM), the job remains in `status = 'running'`.
- The sweeper queries jobs where `status = 'running' AND locked_until < now()`.
- The `claim_jobs()` function automatically treats these expired leases as claimable, re-enqueuing them with incremented `attempts`.

---

## 5. Non-Blocking Owner Decisions

The following architectural choices have been made with production defaults and do NOT block Phase 7 implementation:

1. **Dedicated `reminder_settings` Table:**
   - *Chosen Default:* Created a dedicated `reminder_settings` table instead of adding 10 columns to `user_settings`.
   - *Rationale:* Eliminates schema clutter on the 30-column user table and allows clean multi-workspace tenant boundaries.
2. **Catch-Up Invoicing Policy:**
   - *Chosen Default:* Generate at most 1 missed invoice for the latest period upon system recovery; log skipped periods.
   - *Rationale:* Protects client trust by preventing sudden bursts of multiple historical invoices.
3. **Execution Time Budget:**
   - *Chosen Default:* 20 seconds cooperative timeout per cron trigger.
   - *Rationale:* Safely fits within Vercel's standard 30-second serverless execution window.
4. **Entitlement for Automated Reminders:**
   - *Chosen Default:* Pro and Studio tiers only (`emailReminders: true` in `BILLING_PLANS`). Free tier users can send reminders manually.
   - *Rationale:* Matches existing product pricing model established in Phase 6.
5. **Partial Payment Tone:**
   - *Chosen Default:* Automated reminders mention the exact remaining balance (total minus paid) rather than the original gross total.
6. **Quiet Hours Definition:**
   - *Chosen Default:* 20:00 to 08:00 local time, with weekday-only delivery enabled by default.
7. **Template JSONB Limit:**
   - *Chosen Default:* Max 64 KB per recurring invoice template enforced by CHECK constraint.
8. **Cron Scheduling Rate:**
   - *Chosen Default:* Sweeper recommended every 10 minutes.
