-- ==============================================================================
-- FLOWDESK DATABASE RECONCILIATION II: FEATURE CONTRACTS
-- Migration: 20261015000008_feature_contract.sql
-- Description: Second-pass reconciliation between the schema and the *running*
--              application code, covering column sets discovered by tracing the
--              actual insert/update call sites for:
--                projects, documents, deliverables, notifications,
--                deliverable_comments, deliverable_versions, activities,
--                workspace_comments, profiles, account_deletions,
--                billing_events, subscriptions, recurring_invoice_schedules,
--                reminder_log, clients.
--              Every statement is idempotent so this is safe to re-run.
-- ==============================================================================

-- 1. CLIENTS (hourly rate + portal access flag written by /api/clients) --------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT true;

-- 2. PROJECTS (milestones blob + denormalized client name, written by
--    FreelancerProjectService.createProject) -----------------------------------
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;

-- 3. DOCUMENTS (uploader attribution + version label) --------------------------
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS version TEXT;

-- 4. DELIVERABLES / VERSIONS / COMMENTS ---------------------------------------
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS milestone_id TEXT;
ALTER TABLE public.deliverable_versions ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE public.deliverable_comments ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;

-- 5. ACTIVITIES (actor identity) ----------------------------------------------
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_avatar TEXT;

-- 6. NOTIFICATIONS (priority written by NotificationHelper) -------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- 7. WORKSPACE COMMENTS (avatar alias used by the comment service) ------------
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS avatar TEXT;

-- 8. PROFILES (professional title) --------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- 9. ACCOUNT DELETIONS (lifecycle timestamps) ---------------------------------
ALTER TABLE public.account_deletions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.account_deletions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 10. BILLING EVENTS (webhook idempotency + processing metadata) --------------
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS error TEXT;
UPDATE public.billing_events SET type = COALESCE(type, event_type) WHERE type IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON public.billing_events(type);

-- 11. SUBSCRIPTIONS (provider identifiers + billing interval) -----------------
--     /api/billing/checkout upserts with onConflict: 'workspace_id', so a unique
--     index on workspace_id is required.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'razorpay';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_workspace
  ON public.subscriptions(workspace_id);

-- 12. RECURRING INVOICE SCHEDULES (full schedule configuration) ---------------
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS interval_days INTEGER;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS anchor_date DATE;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS ends_on DATE;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS max_occurrences INTEGER;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS occurrences_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS due_in_days INTEGER NOT NULL DEFAULT 14;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS template JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.recurring_invoice_schedules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 13. REMINDER LOG (link to the dispatched email event) -----------------------
ALTER TABLE public.reminder_log ADD COLUMN IF NOT EXISTS email_event_id UUID REFERENCES public.email_events(id) ON DELETE SET NULL;
