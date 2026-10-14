-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: CORE RELATIONAL SCHEMA
-- Migration: 20261015000001_core_schema.sql
-- Description: Creates normalized tables, extensions, foreign keys, and primary keys.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES & USER SETTINGS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  logo_url TEXT,
  signature_url TEXT,
  business_name TEXT,
  company_name TEXT,
  profession TEXT,
  email TEXT,
  phone TEXT,
  country TEXT DEFAULT 'India',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  language TEXT DEFAULT 'English',
  currency TEXT DEFAULT 'USD',
  hourly_rate NUMERIC(10,2) DEFAULT 120.00,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'America/New_York',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  week_start TEXT DEFAULT 'Monday',
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_number_format TEXT DEFAULT 'prefix_year_sequence',
  invoice_separator TEXT DEFAULT '-',
  invoice_include_year BOOLEAN DEFAULT true,
  invoice_padding INTEGER DEFAULT 4,
  invoice_next_sequence INTEGER DEFAULT 1,
  invoice_annual_reset BOOLEAN DEFAULT false,
  default_tax_rate NUMERIC(5,2) DEFAULT 0.00,
  tax_name TEXT DEFAULT 'Tax',
  default_payment_terms INTEGER DEFAULT 14,
  email_notifications BOOLEAN DEFAULT true,
  email_deliverables BOOLEAN DEFAULT true,
  email_documents BOOLEAN DEFAULT true,
  email_invoices BOOLEAN DEFAULT true,
  invoice_reminders BOOLEAN DEFAULT true,
  comment_alerts BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Workspace',
  logo_url TEXT,
  signature_url TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CLIENTS & PORTAL INVITATIONS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_token TEXT UNIQUE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  avatar_url TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  health_badge TEXT DEFAULT 'healthy',
  total_billed NUMERIC(12,2) DEFAULT 0.00,
  active_projects_count INTEGER DEFAULT 0,
  country TEXT DEFAULT 'India',
  timezone TEXT,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  tags TEXT[],
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  freelancer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  recipient_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);

-- 5. PROJECTS & MILESTONES
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  priority TEXT DEFAULT 'medium',
  budget NUMERIC(12,2) DEFAULT 0.00,
  spent NUMERIC(12,2) DEFAULT 0.00,
  start_date DATE,
  due_date DATE,
  completion_percentage INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. DELIVERABLES, VERSIONS, FILES & COMMENTS
CREATE TABLE IF NOT EXISTS public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  review_deadline DATE,
  current_version TEXT DEFAULT 'v1.0',
  submission_message TEXT,
  rejection_reason TEXT,
  files_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverable_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  note TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverable_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.deliverable_versions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size TEXT,
  file_type TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverable_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_avatar TEXT,
  author_role TEXT DEFAULT 'client',
  is_internal BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'other',
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  folder TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT false,
  due_date DATE,
  file_name TEXT,
  file_size TEXT,
  file_url TEXT,
  mime_type TEXT,
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. RECURRING INVOICE SCHEDULES
CREATE TABLE IF NOT EXISTS public.recurring_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  auto_send BOOLEAN DEFAULT false,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. INVOICES & PAYMENTS (RESTRICT ON CLIENT DELETION PRESERVES FINANCIAL AUDIT)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  workflow_status TEXT DEFAULT 'draft',
  payment_status TEXT DEFAULT 'pending',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_percentage NUMERIC(5,2) DEFAULT 0.00,
  tax_name TEXT DEFAULT 'Tax',
  tax_amount NUMERIC(12,2) DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12,2) DEFAULT 0.00,
  paid_amount NUMERIC(12,2) DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  payment_instructions TEXT,
  internal_notes TEXT,
  recurring_schedule_id UUID REFERENCES public.recurring_invoice_schedules(id) ON DELETE SET NULL,
  recurrence_period_key TEXT,
  viewed_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'other',
  payment_date TIMESTAMPTZ DEFAULT now(),
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. COLLABORATION, ACTIVITIES & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.workspace_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  deliverable_id UUID REFERENCES public.deliverables(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  author_avatar TEXT,
  author_role TEXT DEFAULT 'client',
  text TEXT NOT NULL,
  is_owner BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES public.workspace_comments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  user_name TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  link TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. SUBSCRIPTIONS, BILLING & OVERRIDES
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT UNIQUE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  value JSONB NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  value NUMERIC(16,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_workspace_metric UNIQUE(workspace_id, metric)
);

-- 12. JOBS, RUNS & REMINDER AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT true,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_reminder_dedupe UNIQUE(workspace_id, invoice_id, rule_key)
);

-- 13. ACCOUNT DELETIONS (AUDIT LEDGER)
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_company TEXT,
  deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  restore_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_deletion',
  metadata JSONB
);
-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: INDEXES, UNIQUE CONSTRAINTS & CHECKS
-- Migration: 20261015000002_indexes_and_constraints.sql
-- Description: Creates performance indexes on foreign keys, unique business constraints,
--              and validation check constraints.
-- ==============================================================================

-- 1. PROFILES & WORKSPACES INDEXES
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. CLIENTS INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS chk_clients_status;
ALTER TABLE public.clients ADD CONSTRAINT chk_clients_status
  CHECK (status IN ('active', 'inactive', 'lead', 'archived', 'pending_deletion', 'invited'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS chk_clients_total_billed;
ALTER TABLE public.clients ADD CONSTRAINT chk_clients_total_billed
  CHECK (total_billed >= 0);

-- 3. CLIENT INVITATIONS INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON public.client_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_client_id ON public.client_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.client_invitations(status);

ALTER TABLE public.client_invitations DROP CONSTRAINT IF EXISTS chk_invitations_status;
ALTER TABLE public.client_invitations ADD CONSTRAINT chk_invitations_status
  CHECK (status IN ('pending', 'claimed', 'expired', 'revoked'));

-- 4. PROJECTS & MILESTONES INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones(project_id);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_projects_status;
ALTER TABLE public.projects ADD CONSTRAINT chk_projects_status
  CHECK (status IN ('in_progress', 'review', 'completed', 'on_hold', 'archived'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_projects_completion;
ALTER TABLE public.projects ADD CONSTRAINT chk_projects_completion
  CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_projects_budget;
ALTER TABLE public.projects ADD CONSTRAINT chk_projects_budget
  CHECK (budget >= 0 AND spent >= 0);

-- 5. DELIVERABLES INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_deliverables_workspace_id ON public.deliverables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_client_id ON public.deliverables(client_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON public.deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON public.deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_approval_status ON public.deliverables(approval_status);
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_deliverable_id ON public.deliverable_versions(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_files_deliverable_id ON public.deliverable_files(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_comments_deliverable_id ON public.deliverable_comments(deliverable_id);

ALTER TABLE public.deliverables DROP CONSTRAINT IF EXISTS chk_deliverables_status;
ALTER TABLE public.deliverables ADD CONSTRAINT chk_deliverables_status
  CHECK (status IN ('draft', 'preparing', 'ready_for_review', 'submitted', 'approved', 'revision_requested', 'completed', 'archived'));

ALTER TABLE public.deliverables DROP CONSTRAINT IF EXISTS chk_deliverables_approval;
ALTER TABLE public.deliverables ADD CONSTRAINT chk_deliverables_approval
  CHECK (approval_status IN ('pending', 'viewed', 'approved', 'rejected', 'revision_requested', 'expired'));

-- 6. DOCUMENTS INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON public.documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_is_internal ON public.documents(is_internal);

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS chk_documents_status;
ALTER TABLE public.documents ADD CONSTRAINT chk_documents_status
  CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected', 'missing', 'draft', 'sent', 'signed', 'expired'));

-- 7. INVOICES & PAYMENTS INDEXES & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id ON public.invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_workspace_id ON public.invoice_payments(workspace_id);

-- Enforce unique invoice number within workspace
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS uq_invoice_workspace_number;
ALTER TABLE public.invoices ADD CONSTRAINT uq_invoice_workspace_number
  UNIQUE (workspace_id, invoice_number);

-- Enforce idempotent generation per recurring schedule and period key
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_recurring_period
  ON public.invoices(recurring_schedule_id, recurrence_period_key)
  WHERE recurring_schedule_id IS NOT NULL AND recurrence_period_key IS NOT NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS chk_invoices_amounts;
ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_amounts
  CHECK (subtotal >= 0 AND tax_amount >= 0 AND total_amount >= 0 AND paid_amount >= 0 AND discount >= 0);

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS chk_invoice_items_quantities;
ALTER TABLE public.invoice_items ADD CONSTRAINT chk_invoice_items_quantities
  CHECK (quantity > 0 AND unit_price >= 0 AND amount >= 0);

ALTER TABLE public.invoice_payments DROP CONSTRAINT IF EXISTS chk_invoice_payments_amount;
ALTER TABLE public.invoice_payments ADD CONSTRAINT chk_invoice_payments_amount
  CHECK (amount > 0);

-- 8. COLLABORATION, ACTIVITIES & NOTIFICATIONS INDEXES
CREATE INDEX IF NOT EXISTS idx_workspace_comments_workspace_id ON public.workspace_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_comments_client_id ON public.workspace_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_workspace_comments_is_internal ON public.workspace_comments(is_internal);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON public.activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_client_id ON public.activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- 9. JOBS & SUBSCRIPTION INDEXES
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_status ON public.jobs(workspace_id, status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_dedupe_key ON public.jobs(workspace_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON public.job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON public.subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_lookup ON public.reminder_log(workspace_id, invoice_id, rule_key);
-- ==============================================================================
-- FLOWDESK ROW-LEVEL SECURITY (RLS) POLICIES & SECURITY DEFINER HELPERS
-- Migration: 20261015000003_rls_policies.sql
-- Description: Enables RLS on all tables and implements least-privilege policies
--              for workspace owners and authenticated client portal users.
-- ==============================================================================

-- 1. SECURITY DEFINER AUTHORIZATION HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_workspace_owner(check_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = check_workspace_id
      AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
    AND status != 'pending_deletion';
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(check_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = check_client_id
      AND user_id = auth.uid()
      AND status != 'pending_deletion'
  );
$$;

-- 2. ENABLE ROW LEVEL SECURITY ON ALL APPLICATION TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_workspace" ON public.profiles;
CREATE POLICY "profiles_select_own_or_workspace" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    id IN (
      SELECT w.owner_id FROM public.workspaces w
      JOIN public.clients c ON c.workspace_id = w.id
      WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. USER SETTINGS POLICIES
DROP POLICY IF EXISTS "user_settings_all_own" ON public.user_settings;
CREATE POLICY "user_settings_all_own" ON public.user_settings
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. WORKSPACES POLICIES
DROP POLICY IF EXISTS "workspaces_select_owner_or_client" ON public.workspaces;
CREATE POLICY "workspaces_select_owner_or_client" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "workspaces_manage_owner" ON public.workspaces;
CREATE POLICY "workspaces_manage_owner" ON public.workspaces
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 6. CLIENTS POLICIES
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "clients_owner_insert" ON public.clients;
CREATE POLICY "clients_owner_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    user_id = auth.uid()
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (user_id = auth.uid() AND workspace_id = workspace_id)
  );

DROP POLICY IF EXISTS "clients_owner_delete" ON public.clients;
CREATE POLICY "clients_owner_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- 7. CLIENT INVITATIONS POLICIES
DROP POLICY IF EXISTS "invitations_owner_manage" ON public.client_invitations;
CREATE POLICY "invitations_owner_manage" ON public.client_invitations
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 8. PROJECTS & MILESTONES POLICIES
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "projects_owner_manage" ON public.projects;
CREATE POLICY "projects_owner_manage" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "milestones_select" ON public.project_milestones;
CREATE POLICY "milestones_select" ON public.project_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (public.is_workspace_owner(p.workspace_id) OR p.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "milestones_owner_manage" ON public.project_milestones;
CREATE POLICY "milestones_owner_manage" ON public.project_milestones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  );

-- 9. DELIVERABLES POLICIES
DROP POLICY IF EXISTS "deliverables_select" ON public.deliverables;
CREATE POLICY "deliverables_select" ON public.deliverables
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND status != 'archived')
  );

DROP POLICY IF EXISTS "deliverables_insert" ON public.deliverables;
CREATE POLICY "deliverables_insert" ON public.deliverables
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "deliverables_update" ON public.deliverables;
CREATE POLICY "deliverables_update" ON public.deliverables
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "deliverables_delete" ON public.deliverables;
CREATE POLICY "deliverables_delete" ON public.deliverables
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "deliv_versions_select" ON public.deliverable_versions;
CREATE POLICY "deliv_versions_select" ON public.deliverable_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_versions_manage" ON public.deliverable_versions;
CREATE POLICY "deliv_versions_manage" ON public.deliverable_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  );

DROP POLICY IF EXISTS "deliv_files_select" ON public.deliverable_files;
CREATE POLICY "deliv_files_select" ON public.deliverable_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_files_insert" ON public.deliverable_files;
CREATE POLICY "deliv_files_insert" ON public.deliverable_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_comments_select" ON public.deliverable_comments;
CREATE POLICY "deliv_comments_select" ON public.deliverable_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (
          public.is_workspace_owner(d.workspace_id) OR
          (d.client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
        )
    )
  );

DROP POLICY IF EXISTS "deliv_comments_insert" ON public.deliverable_comments;
CREATE POLICY "deliv_comments_insert" ON public.deliverable_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (
          public.is_workspace_owner(d.workspace_id) OR
          (d.client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
        )
    )
  );

-- 10. DOCUMENTS POLICIES (INTERNAL DOCUMENTS HIDDEN FROM CLIENTS)
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- 11. INVOICES & PAYMENTS POLICIES
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "invoices_manage_owner" ON public.invoices;
CREATE POLICY "invoices_manage_owner" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (public.is_workspace_owner(i.workspace_id) OR i.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "invoice_items_manage" ON public.invoice_items;
CREATE POLICY "invoice_items_manage" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.is_workspace_owner(i.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.is_workspace_owner(i.workspace_id)
    )
  );

DROP POLICY IF EXISTS "invoice_payments_select" ON public.invoice_payments;
CREATE POLICY "invoice_payments_select" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

DROP POLICY IF EXISTS "invoice_payments_insert" ON public.invoice_payments;
CREATE POLICY "invoice_payments_insert" ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 12. COLLABORATION COMMENTS (INTERNAL COMMENTS RESTRICTED TO FREELANCER)
DROP POLICY IF EXISTS "comments_select" ON public.workspace_comments;
CREATE POLICY "comments_select" ON public.workspace_comments
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "comments_insert" ON public.workspace_comments;
CREATE POLICY "comments_insert" ON public.workspace_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "comments_manage_owner" ON public.workspace_comments;
CREATE POLICY "comments_manage_owner" ON public.workspace_comments
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 13. ACTIVITIES & NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 14. SUBSCRIPTIONS, JOBS, REMINDERS & ACCOUNT DELETION POLICIES
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "billing_events_select" ON public.billing_events;
CREATE POLICY "billing_events_select" ON public.billing_events
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "entitlements_select" ON public.entitlement_overrides;
CREATE POLICY "entitlements_select" ON public.entitlement_overrides
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "usage_counters_select" ON public.usage_counters;
CREATE POLICY "usage_counters_select" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "job_runs_select" ON public.job_runs;
CREATE POLICY "job_runs_select" ON public.job_runs
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "reminder_settings_owner" ON public.reminder_settings;
CREATE POLICY "reminder_settings_owner" ON public.reminder_settings
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "reminder_log_select" ON public.reminder_log;
CREATE POLICY "reminder_log_select" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "account_deletions_select" ON public.account_deletions;
CREATE POLICY "account_deletions_select" ON public.account_deletions
  FOR SELECT TO authenticated
  USING (deleted_by = auth.uid());
-- ==============================================================================
-- FLOWDESK STORAGE REBUILD: BUCKET PROVISIONING & CONFIGURATION
-- Migration: 20261015000004_storage_buckets.sql
-- Description: Provisions the 5 required Supabase storage buckets with validated
--              size limits and MIME type rules.
-- Note: Does NOT modify storage.objects (which requires supabase_storage_admin).
-- ==============================================================================

-- 1. PROVISION PUBLIC STORAGE BUCKETS (AVATARS, LOGOS, SIGNATURES)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'logos',
    'logos',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'signatures',
    'signatures',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. PROVISION PRIVATE STORAGE BUCKETS (DOCUMENTS, DELIVERABLES)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'documents',
    'documents',
    false, -- Strictly private, requires signed URLs
    26214400, -- 25 MB
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]
  ),
  (
    'deliverables',
    'deliverables',
    false, -- Strictly private, requires signed URLs
    52428800, -- 50 MB
    ARRAY[
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- ==============================================================================
-- FLOWDESK AUTH INTEGRATION: TRIGGERS & AUTOMATIC PROVISIONING
-- Migration: 20261015000005_auth_triggers.sql
-- Description: Sets up triggers on auth.users for automatic profile, workspace,
--              and settings creation upon signup, plus backfill for existing users.
-- ==============================================================================

-- 1. FUNCTION: handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_full_name TEXT;
  v_client_id UUID;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_business_name := COALESCE(
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'company_name',
    'My Workspace'
  );

  -- 1. Create Profile
  INSERT INTO public.profiles (
    id,
    full_name,
    business_name,
    email,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_business_name,
    NEW.email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- 2. Create User Settings
  INSERT INTO public.user_settings (id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 3. Create Workspace
  INSERT INTO public.workspaces (
    owner_id,
    name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_business_name,
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  -- 4. Auto-bind to client portal record if matching email exists and is unbound
  IF NEW.email IS NOT NULL THEN
    UPDATE public.clients
    SET user_id = NEW.id,
        updated_at = now()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. TRIGGER: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. BACKFILL FOR EXISTING AUTH USERS
-- Ensures existing auth users immediately receive profiles, user_settings, and workspaces
DO $$
DECLARE
  r RECORD;
  v_name TEXT;
  v_ws TEXT;
BEGIN
  FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    v_name := COALESCE(
      r.raw_user_meta_data->>'full_name',
      r.raw_user_meta_data->>'name',
      SPLIT_PART(r.email, '@', 1),
      'Freelancer'
    );
    v_ws := COALESCE(
      r.raw_user_meta_data->>'business_name',
      'My Workspace'
    );

    -- Insert profile if missing
    INSERT INTO public.profiles (id, full_name, business_name, email, onboarding_completed, created_at, updated_at)
    VALUES (r.id, v_name, v_ws, r.email, true, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Insert user_settings if missing
    INSERT INTO public.user_settings (id, created_at, updated_at)
    VALUES (r.id, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Insert workspace if user doesn't already own one
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = r.id) THEN
      INSERT INTO public.workspaces (owner_id, name, created_at, updated_at)
      VALUES (r.id, v_ws, now(), now());
    END IF;

    -- Auto-bind client record if email matches
    IF r.email IS NOT NULL THEN
      UPDATE public.clients
      SET user_id = r.id,
          updated_at = now()
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(r.email))
        AND user_id IS NULL;
    END IF;
  END LOOP;
END $$;
