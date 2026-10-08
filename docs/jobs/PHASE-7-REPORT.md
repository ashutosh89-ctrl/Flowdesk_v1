# Phase 7 Engineering Report: Background Job Infrastructure, Recurring Invoices, and Automated Payment Reminders

**Date:** 2026-10-08  
**Scope:** Background Job Infrastructure, Recurring Invoices, Automated Payment Reminders, Automations & Job Observability  
**Status:** Implementation Complete, All 31 CI Test Suites Passing (100%), Unapplied Migration Staged  

---

## 1. Executive Summary

Phase 7 introduces automated background operations to FlowDesk without introducing heavy external message queues or worker daemons. The architecture relies on an ACID-compliant Postgres job runner using `FOR UPDATE SKIP LOCKED` lease claiming, idempotent state machines for recurring schedules and reminders, and a protected, serverless-friendly cron trigger (`POST /api/cron/run-jobs`).

All financial operations adhere strictly to integer subunit arithmetic (`Math.round`), atomic invoice sequence numbering, and immutable template snapshots. Automated delivery safeguards prevent spam, respect quiet hours and weekday policies, and fail closed if unconfigured.

---

## 2. Task-by-Task Implementation Summary

### Task 1: Database Schema & Migration (`database/migrations/phase41_jobs_and_recurring_invoices.sql`)
- **Tables Created:**
  - `jobs`: Stores unit-of-work state (`queued`, `running`, `succeeded`, `failed`, `dead`), exponential backoff attempts, runner leases (`locked_by`, `locked_until`), and redacted errors. Partial unique index on `dedupe_key WHERE dedupe_key IS NOT NULL`.
  - `job_runs`: Append-only audit log tracking worker ID, execution duration, and outcome per invocation.
  - `recurring_invoice_schedules`: Workspace-scoped schedules with frequency, anchor date, day of month, IANA timezone, template snapshot JSONB, and running occurrence counts.
  - `reminder_settings`: Dedicated workspace table controlling cadence days (`before_due`, `on_due`, `after_due_1/2/3`), quiet hours (start/end hours), weekday-only delivery, and master kill switches.
  - `reminder_log`: Deduplication ledger enforcing `UNIQUE(invoice_id, rule_key)` so retries and duplicate sweeps never double-notify a client.
- **Invoices Alteration:** Added `recurring_schedule_id UUID` and `recurrence_period_key TEXT` with partial unique index `UNIQUE(recurring_schedule_id, recurrence_period_key)` preventing duplicate invoice generation.
- **RPC Lease Functions:**
  - `claim_jobs(batch_size, worker_id, lease_seconds)`: Uses `FOR UPDATE SKIP LOCKED` to safely claim queued jobs and lease-expired jobs without worker collision.
  - `complete_job(job_id, worker_id)` and `fail_job(job_id, worker_id, error_message, retry_run_at, is_dead)`: Atomic transitions.
  - All functions defined with `SECURITY DEFINER`, fixed `SET search_path = public, pg_temp`, execution revoked from `PUBLIC`, `anon`, and `authenticated`, granted strictly to `service_role`.
- **RLS & Security:**
  - Client portal users have zero access to schedules, settings, or jobs.
  - Workspace owners have `SELECT` access to their own workspace schedules and settings; mutations remain strictly server-side through authenticated API routes.

### Task 2: Job Runner Engine (`src/backend/jobs/`)
- **Module Structure:**
  - `types.ts`: TypeScript contracts for jobs, payloads, handler definitions, and runner options.
  - `registry.ts`: Registry for job handlers (`generate_recurring_invoice`, `send_invoice`, `send_invoice_reminder`).
  - `queue.ts`: Safe enqueuing with deduplication and lease renewal helpers.
  - `runner.ts`: Serverless-aware runner with a default 20-second hard execution budget (`MAX_TIME_BUDGET_MS = 20_000`), exponential backoff with jitter (`Math.min(3600, base * 2^attempts) + jitter`), and dead-letter queue (DLQ) state transition after 5 attempts.
  - `sweeper.ts`: Sweeps active recurring schedules whose `next_run_at <= now` and invoices needing reminders, enqueuing them with unique period/rule dedupe keys. Releases expired leases.
  - `app/api/cron/run-jobs/route.ts`: Timing-safe `CRON_SECRET` validation using `crypto.timingSafeEqual`, fail-closed if missing, dry-run mode default (`CRON_DRY_RUN !== 'false'`), rate limited, non-cacheable (`Cache-Control: no-store`).

### Task 3: Recurring Invoices
- **Pure Rules (`src/shared/rules/recurring-rules.ts`):**
  - `computeNextRunAt(schedule, from)`: Handles month-end clamping (Jan 31 -> Feb 28/29), leap years, DST transitions, weekly year boundaries, custom day intervals, `ends_on`, and `max_occurrences`.
  - `generatePeriodKey(schedule, runAt)`: Predictable period keys (e.g. `2026-W41`, `2026-10`, `2026-Q4`, `2026-INTERVAL-1760000000000`).
  - `projectUpcomingOccurrences(schedule, count)`: Generates future occurrence projections for client previews.
- **Shared Invoice Generation (`src/backend/invoices/invoice-service.ts`):**
  - Factored out `createInvoiceCore()` shared by both manual invoice creation and automated recurring generator.
  - Guarantees identical atomic invoice numbering (`invoice_sequences`), tax/discount totals via `src/shared/rules`, and item validation.
- **Handler (`generate_recurring_invoice`):**
  - Reloads schedule, verifies workspace and client active state, creates invoice with template snapshot, records `recurrence_period_key`. Handles database `23505` unique violation as an idempotent no-op. Advances `next_run_at` and `occurrences_count`. Enqueues `send_invoice` if `auto_send` is enabled.
- **Catch-up Policy:**
  - In event of system downtime, generates at most ONE invoice for the latest due period, logs skipped periods, and advances `next_run_at` to the upcoming valid cycle to prevent flooding clients with multiple backdated invoices.
- **Routes Created:**
  - `GET /api/invoices/recurring`: List workspace schedules.
  - `POST /api/invoices/recurring`: Create new schedule (validates client existence, template structure).
  - `POST /api/invoices/recurring/preview`: Preview next 3 occurrences with calculated dates and amounts.
  - `GET /api/invoices/recurring/[scheduleId]`: Fetch schedule details.
  - `PATCH /api/invoices/recurring/[scheduleId]`: Edit schedule (does not alter previously generated invoices).
  - `POST /api/invoices/recurring/[scheduleId]/status`: Pause, resume, or cancel schedule.
  - `POST /api/invoices/recurring/[scheduleId]/run-now`: Run on demand (idempotently processes current period).

### Task 4: Automated Payment Reminders
- **Pure Rules (`src/shared/rules/reminder-rules.ts`):**
  - `decideReminders(invoice, settings, now, alreadySentRules)`: Evaluates rules (`before_due_3d`, `due_date`, `after_due_3d`, `after_due_7d`, `after_due_14d`).
  - Stop conditions enforced: Paid, Void, Cancelled, Draft, reminders disabled, client disconnected, maximum reminders exceeded (default max 5).
  - Schedule constraints: Quiet hours (e.g., 20:00 to 08:00) and weekends blocked if configured.
- **Handler & Email Service (`src/backend/jobs/handlers/send-invoice-reminder.ts`):**
  - Re-evaluates invoice status right before sending.
  - Injects authenticated client portal links (never raw secrets or tokens in URLs).
  - Records send event in `reminder_log` and updates invoice reminder metadata.
- **Manual Reminders:**
  - `POST /api/invoices/[invoiceId]/reminder`: Manual trigger by freelancer; increments reminder count and writes to `reminder_log` (`manual_<timestamp>`).
- **Settings Routes:**
  - `GET /api/invoices/reminders/settings`: Get reminder configuration.
  - `PATCH /api/invoices/reminders/settings`: Update cadence toggles, quiet hours, and weekday preferences.

### Task 5: UI & Observability
- **Automations View (`src/frontend/freelancer/settings/automations-panel.tsx`):**
  - Embedded as "Automations & Jobs" tab in the freelancer Settings view.
  - Tab 1: **Recurring Invoices** (active/paused/cancelled schedules, occurrences count, next run date, Create Schedule Modal with live preview, pause/resume/cancel/run-now actions).
  - Tab 2: **Payment Reminders** (stage toggles, quiet hours inputs, weekday-only checkbox, preview of example invoice reminder dates).
  - Tab 3: **Job Engine Health & DLQ** (runner status pill, 7-day processed job metrics, failed job alerts, dead letter queue table with owner-scoped retry button).
- **Invoice Badges:**
  - Added `RecurringInvoiceBadge` to `status-pills.tsx` and displayed on invoice rows in `invoices-list-view.tsx` with recurrence period tooltip and schedule indicator.
- **Telemetry API Routes:**
  - `GET /api/jobs/health`: Aggregated telemetry (active/failed/dead jobs in last 7 days).
  - `POST /api/jobs/[jobId]/retry`: Reset dead job back to `queued` with 0 attempts for immediate retry.

### Task 6: Comprehensive Automated Tests
- **Created 5 new test suites (35 unit tests):**
  1. `tests/recurring-rules.test.ts` (10 tests): Month-end clamping, leap years, DST, weekly boundaries, ends_on, max occurrences.
  2. `tests/reminder-rules.test.ts` (9 tests): Stop conditions, quiet hours, weekend delivery filters, partial payments, max reminder cap.
  3. `tests/job-runner.test.ts` (9 tests): Enqueue deduplication, claiming, backoff/retry, DLQ dead-lettering, serverless time budget.
  4. `tests/recurring-invoices.test.ts` (2 tests): Idempotent double execution, parity between manual and recurring invoice creation.
  5. `tests/cron-jobs-route.test.ts` (5 tests): Timing-safe CRON_SECRET, unauthorized rejection, dry-run mode safety, fail closed.
- All suites integrated into `scripts/test-all.ts` (31 total steps).

---

## 3. Files Created and Modified

### Created Files (16)
- `database/migrations/phase41_jobs_and_recurring_invoices.sql` (Unapplied DDL & functions)
- `docs/jobs/JOBS-DESIGN.md` (Design architecture specification)
- `docs/jobs/PHASE-7-REPORT.md` (This document)
- `src/shared/rules/recurring-rules.ts` (Pure scheduling rules)
- `src/shared/rules/reminder-rules.ts` (Pure reminder rules)
- `src/backend/jobs/types.ts` (Job engine contracts)
- `src/backend/jobs/registry.ts` (Job handler registry)
- `src/backend/jobs/queue.ts` (Enqueue & lease renewals)
- `src/backend/jobs/runner.ts` (Lease claim & run engine)
- `src/backend/jobs/sweeper.ts` (Due schedule & reminder sweeper)
- `src/backend/jobs/index.ts` (Job module facade)
- `src/backend/jobs/handlers/generate-recurring-invoice.ts` (Invoice generation handler)
- `src/backend/jobs/handlers/send-invoice.ts` (Email send handler)
- `src/backend/jobs/handlers/send-invoice-reminder.ts` (Reminder send handler)
- `src/backend/invoices/invoice-service.ts` (Shared invoice creation logic)
- `src/frontend/freelancer/settings/automations-panel.tsx` (Automations UI component)
- `app/api/cron/run-jobs/route.ts` (Cron worker trigger endpoint)
- `app/api/invoices/recurring/route.ts` (List & create recurring schedules)
- `app/api/invoices/recurring/preview/route.ts` (Schedule preview endpoint)
- `app/api/invoices/recurring/[scheduleId]/route.ts` (Get & edit schedule)
- `app/api/invoices/recurring/[scheduleId]/status/route.ts` (Pause/resume/cancel schedule)
- `app/api/invoices/recurring/[scheduleId]/run-now/route.ts` (Manual trigger for schedule)
- `app/api/invoices/reminders/settings/route.ts` (Reminder preferences)
- `app/api/invoices/[invoiceId]/reminder/route.ts` (Manual reminder endpoint)
- `app/api/jobs/health/route.ts` (Health & metrics API)
- `app/api/jobs/[jobId]/retry/route.ts` (Dead letter retry API)
- `tests/recurring-rules.test.ts` (Unit test suite)
- `tests/reminder-rules.test.ts` (Unit test suite)
- `tests/job-runner.test.ts` (Unit test suite)
- `tests/recurring-invoices.test.ts` (Unit test suite)
- `tests/cron-jobs-route.test.ts` (Unit test suite)

### Modified Files (9)
- `.env.example`: Added placeholders for `CRON_SECRET`, `CRON_DRY_RUN`, `ENABLE_RECURRING_INVOICES`, `ENABLE_AUTOMATED_REMINDERS`.
- `scripts/test-all.ts`: Registered Phase 7 test suites into the unified test runner.
- `src/backend/email/templates/index.ts`: Added HTML template `renderInvoiceReminderEmail`.
- `src/backend/email/email-service.ts`: Added `sendInvoiceReminder` and mapped `invoice_reminder` to `invoices` preference category.
- `src/frontend/freelancer/invoices/components/status-pills.tsx`: Added `RecurringInvoiceBadge`.
- `src/frontend/freelancer/invoices/invoices-list-view.tsx`: Displayed recurring badge and schedule indicator on recurring invoices.
- `src/frontend/freelancer/settings/settings-view.tsx`: Registered "Automations & Jobs" tab.
- `src/shared/rules/index.ts`: Re-exported recurring and reminder pure functions.
- `src/shared/validation/schemas.ts`: Added Zod schemas for recurring schedules and reminders.

---

## 4. Migration Plan & Apply Order

### Migration Details
- **File:** `database/migrations/phase41_jobs_and_recurring_invoices.sql`
- **Current State:** **UNAPPLIED** (staged in repository for deployment).
- **Prerequisites:** `phase40_billing_and_entitlements.sql` (or prior latest schema).

### Deployment & Apply Sequence
To ensure zero downtime:
1. **Step 1 (Pre-deploy Migration):** Apply `phase41_jobs_and_recurring_invoices.sql` to Postgres. All tables and column additions are purely additive (`nullable` foreign keys and separate tables), causing zero breaking changes to existing traffic.
2. **Step 2 (Deploy Code):** Deploy Next.js Phase 7 code containing backend routes, UI, and job handlers.
3. **Step 3 (Enable Cron & Dry-Run Verification):** Set `CRON_SECRET` in environment variables with `CRON_DRY_RUN=true`. Trigger the cron endpoint to verify 200 OK responses with dry-run logs.
4. **Step 4 (Go Live):** Set `CRON_DRY_RUN=false` in production environment variables to activate live job execution.

---

## 5. Verification: Baseline vs Final

| Test / Gate | Baseline (Before Phase 7) | Final Result (After Phase 7) | Status |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | 0 errors | 0 errors | **PASS** |
| `npm run lint` | 0 errors, 4 legacy `<img>` warnings | 0 errors, 4 legacy `<img>` warnings | **PASS** |
| `npm run check:secrets` | 0 secrets in 409 files | 0 secrets in 418 files | **PASS** |
| `npm run build` | Next.js production build PASS | Next.js production build PASS (49 static/dynamic pages) | **PASS** |
| `npm run test:all` | 26/26 suites PASS | **31/31 suites PASS (100%)** | **PASS** |

---

## 6. Manual Runbook

### A. Environment Configuration
Add the following keys to your deployment platform (Vercel, Supabase, or AWS):
```bash
# Cron Execution Secret (Use a 32+ character random hex string)
CRON_SECRET=flowdesk_cron_secret_stage_replace_me

# Default Safety Switch (Set to 'true' in staging or initial production deploy)
CRON_DRY_RUN=false

# Feature Flags / Kill Switches (Default to 'true' if unset)
ENABLE_RECURRING_INVOICES=true
ENABLE_AUTOMATED_REMINDERS=true
```

### B. Scheduler Options

#### Option 1: Vercel Cron (Recommended for Vercel Deployments)
Add a cron trigger in `vercel.json` (triggering every 10 minutes):
```json
{
  "crons": [
    {
      "path": "/api/cron/run-jobs",
      "schedule": "*/10 * * * *"
    }
  ]
}
```
*Note:* Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when configured in project settings.

#### Option 2: pg_cron (Database Internal)
If running on Supabase with the `pg_cron` extension enabled:
```sql
SELECT cron.schedule(
  'flowdesk-run-jobs',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-domain.com/api/cron/run-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### C. Staging Verification & Dry-Run Walkthrough
1. **Deploy to Staging** with `CRON_DRY_RUN=true`.
2. **Trigger Dry-Run Manually:**
   ```bash
   curl -X POST https://staging.flowdesk.com/api/cron/run-jobs \
     -H "Authorization: Bearer flowdesk_cron_secret_stage_replace_me" \
     -H "Content-Type: application/json"
   ```
3. **Verify Response:**
   ```json
   {
     "success": true,
     "dryRun": true,
     "swept": {
       "schedulesDue": 1,
       "remindersDue": 0,
       "expiredLeasesReleased": 0
     },
     "runner": {
       "processed": 0,
       "succeeded": 0,
       "failed": 0
     }
   }
   ```
   No real database mutations or emails will occur while `dryRun: true`.

### D. How to Simulate Due Schedules & Late Invoices in Staging
1. **Simulate Due Recurring Schedule:**
   - Create a recurring schedule in Staging Automations UI.
   - Run in Postgres or use the **"Run Now"** button in the Automations UI:
     ```sql
     UPDATE recurring_invoice_schedules
     SET next_run_at = NOW() - INTERVAL '1 hour'
     WHERE id = '<schedule-id>';
     ```
   - Trigger `POST /api/cron/run-jobs` with `CRON_DRY_RUN=false`.
   - Verify that exactly one new invoice is created with badge `Recurring: <period_key>`.
2. **Simulate Late Invoice Needing Reminder:**
   - Create an invoice with due date in the past:
     ```sql
     UPDATE invoices
     SET due_date = (CURRENT_DATE - INTERVAL '3 days')::date,
         status = 'SENT'
     WHERE id = '<invoice-id>';
     ```
   - Ensure quiet hours are not active (or temporarily adjust workspace `reminder_settings.quiet_hours_enabled = false`).
   - Trigger `POST /api/cron/run-jobs`.
   - Verify that an entry is created in `reminder_log` for rule `after_due_3d`.

### E. First Week Monitoring Checklist
1. **Check `/api/jobs/health`:** Confirm `dead7d` is 0 and `failed7d` is negligible.
2. **Lease Expiry Watch:** Monitor logs for `expiredLeasesReleased > 0`. If leases frequently expire, either workers are crashing or the `lease_seconds` (default 60s) is too short for slow external SMTP connections.
3. **Database Locks:** Verify `claim_jobs()` execution times remain < 10ms with `SKIP LOCKED`.
4. **Idempotency Check:** Confirm no invoice duplicate error alerts appear in logs (unique violations are handled gracefully as no-ops).

### F. Emergency Kill Switches & Rollback
- **Instant Kill Switch (No Deploy Required):**
  - To disable recurring invoices: Set `ENABLE_RECURRING_INVOICES=false`.
  - To disable automated payment reminders: Set `ENABLE_AUTOMATED_REMINDERS=false`.
  - To pause all automated jobs completely: Set `CRON_DRY_RUN=true`.
- **Database Rollback:**
  - If migration rollback is ever required:
    ```sql
    DROP FUNCTION IF EXISTS claim_jobs(INTEGER, TEXT, INTEGER);
    DROP FUNCTION IF EXISTS complete_job(UUID, TEXT);
    DROP FUNCTION IF EXISTS fail_job(UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN);
    DROP TABLE IF EXISTS reminder_log;
    DROP TABLE IF EXISTS reminder_settings;
    DROP TABLE IF EXISTS recurring_invoice_schedules;
    DROP TABLE IF EXISTS job_runs;
    DROP TABLE IF EXISTS jobs;
    ALTER TABLE invoices DROP COLUMN IF EXISTS recurring_schedule_id;
    ALTER TABLE invoices DROP COLUMN IF EXISTS recurrence_period_key;
    ```

---

## 7. Entitlements Hook & Phase 6 Integration

In Phase 6, `src/backend/billing/entitlements.ts` introduced `checkEntitlement(workspaceId, featureKey)`. In Phase 7:
- The recurring schedule creation route (`POST /api/invoices/recurring`) checks plan entitlements and schedule limits.
- If `entitlements.ts` is unavailable or if workspace is in demo mode, the system defaults to allowing active schedules up to standard limits and logs a fallback notice.
- A clearly marked extension hook `TODO [Phase 6 Billing Hook]` exists in `src/backend/jobs/handlers/generate-recurring-invoice.ts` to suspend schedules when a workspace transitions to a past-due subscription.

---

## 8. User-Visible Behavior Changes

1. **Settings Navigation:**
   - A new **"Automations & Jobs"** tab is visible in the freelancer settings page (`/dashboard` -> Settings -> Automations & Jobs).
   - Allows freelancers to manage Recurring Invoices, configure Payment Reminders, and view Job Health/DLQ.
2. **Recurring Schedules Management:**
   - Freelancers can create, view, pause, resume, and cancel recurring schedules for clients.
   - When creating a schedule, a live preview computes the next 3 future generation dates and amounts based on selected frequency and items.
   - "Run Now" action enables generating the current cycle's invoice immediately on-demand.
3. **Invoice List View:**
   - Invoices generated from automated recurring schedules display a distinct `Recurring: <period_key>` badge with a link/indicator to their parent schedule.
4. **Payment Reminder Automation:**
   - Clients automatically receive professional HTML reminder emails based on the workspace's configured cadence (e.g. 3 days before due, on due date, 3/7/14 days overdue).
   - Invoices that are paid, draft, or voided never send reminders.
   - Freelancers can still manually trigger reminders via the invoice details menu; manual reminders increment the reminder count and log into `reminder_log`.
5. **Job Health & Dead Letter DLQ:**
   - If a background job fails 5 times, it enters the DLQ. Freelancers and admins can view the failure reason (redacted) and click **"Retry"** to re-queue it.

---

## 9. Decisions I Still Owe (Non-Blocking)

1. **Scheduler Provider Decision:**
   - Confirm whether production will trigger `/api/cron/run-jobs` via **Vercel Cron** (included in `vercel.json`), **pg_cron** on Supabase, or an external webhook provider (e.g., Upstash QStash).
2. **Automated Reminder Tone Customization:**
   - Currently, reminder email templates use three preset tone stages (friendly before due, prompt on due, urgent when overdue). Confirm if custom template editing per workspace is desired in a future phase.
3. **Catch-Up Generation Limit:**
   - The current catch-up policy generates at most 1 invoice for the latest missed cycle if the scheduler is down for an extended period, skipping older periods with a log entry. Confirm if any business use cases require multi-cycle backfilling.
4. **Subscription Past-Due Grace Period:**
   - When a freelancer's FlowDesk subscription is past due (Phase 6), confirm the exact grace period (e.g. 3 days vs immediate) before recurring invoice generators pause execution.

