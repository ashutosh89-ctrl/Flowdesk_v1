-- >>> supabase/migrations/20261015000001_core_schema.sql
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

-- >>> supabase/migrations/20261015000002_indexes_and_constraints.sql
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
  CHECK (status IN ('active', 'inactive', 'lead', 'archived', 'pending_deletion', 'invited', 'pending', 'rejected'));

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

-- >>> supabase/migrations/20261015000003_rls_policies.sql
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

-- >>> supabase/migrations/20261015000004_storage_buckets.sql
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

-- >>> supabase/migrations/20261015000005_auth_triggers.sql
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

-- >>> supabase/migrations/20261015000006_reconciliation.sql
-- ==============================================================================
-- FLOWDESK DATABASE RECONCILIATION: APPLICATION CONTRACT GAPS
-- Migration: 20261015000006_reconciliation.sql
-- Description: Re-derives the exact table/column contract from the current
--              application source and closes gaps the core rebuild omitted:
--                * Missing tables: email_events (transactional email outbox),
--                  razorpay_orders (payment order ledger).
--                * Missing columns on profiles, workspaces, deliverables,
--                  deliverable_versions, deliverable_files, deliverable_comments,
--                  documents, workspace_comments, invoices, invoice_payments.
--              All statements are idempotent (IF NOT EXISTS) so this migration is
--              safe to apply to a database that already contains some objects.
-- ==============================================================================

-- 1. MISSING TABLES -----------------------------------------------------------

-- 1a. Transactional email outbox + delivery tracking.
--     Written by src/backend/email/email-service.ts and the Brevo/Resend webhooks.
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  provider TEXT DEFAULT 'brevo',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  claimed_at TIMESTAMPTZ,
  locked_by TEXT,
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent outbox claim: EmailService relies on a 23505 unique violation to
-- detect a concurrent claim for the same (event_type, reference_id, recipient).
-- Events without a reference_id (account lifecycle, security alerts) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_dedupe
  ON public.email_events(event_type, reference_id, recipient)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_workspace_id ON public.email_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON public.email_events(recipient);
CREATE INDEX IF NOT EXISTS idx_email_events_status ON public.email_events(status);
CREATE INDEX IF NOT EXISTS idx_email_events_next_attempt ON public.email_events(next_attempt_at)
  WHERE status = 'failed';

ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS chk_email_events_status;
ALTER TABLE public.email_events ADD CONSTRAINT chk_email_events_status
  CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'bounced', 'suppressed', 'opened', 'clicked'));

-- 1b. Razorpay payment order ledger.
--     Written by src/backend/payments/payment-service.ts.
CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  amount_subunits BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  receipt TEXT NOT NULL,
  notes JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_workspace_id ON public.razorpay_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_invoice_id ON public.razorpay_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_client_id ON public.razorpay_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status ON public.razorpay_orders(status);

ALTER TABLE public.razorpay_orders DROP CONSTRAINT IF EXISTS chk_razorpay_orders_status;
ALTER TABLE public.razorpay_orders ADD CONSTRAINT chk_razorpay_orders_status
  CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'expired'));

-- 2. MISSING COLUMNS ----------------------------------------------------------

-- 2a. Account lifecycle soft-delete markers (account delete/restore routes).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2b. Deliverables (internal notes, attribution, review lifecycle timestamps).
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

-- 2c. Deliverable versions (file metadata + uploader).
ALTER TABLE public.deliverable_versions ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.deliverable_versions ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE public.deliverable_versions ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2d. Deliverable files (folder grouping + pinning).
ALTER TABLE public.deliverable_files ADD COLUMN IF NOT EXISTS folder TEXT;
ALTER TABLE public.deliverable_files ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2e. Deliverable comments (author id, attachments, threading).
ALTER TABLE public.deliverable_comments ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.deliverable_comments ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';
ALTER TABLE public.deliverable_comments ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.deliverable_comments(id) ON DELETE SET NULL;

-- 2f. Documents (presentation size + legacy download_url column).
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS download_url TEXT;

-- 2g. Workspace comments (threading, mentions, attachments, pinning, read state).
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS reply_to_author TEXT;
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS reply_to_text TEXT;
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS read_by_client BOOLEAN DEFAULT false;

-- 2h. Invoices (denormalized project name snapshot).
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS project_name TEXT;

-- 2i. Invoice payments (gateway + failure/capture tracking).
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'manual';
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS gateway_status TEXT DEFAULT 'completed';
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

-- 3. EXTRA INDEXES INTRODUCED WITH NEW COLUMNS --------------------------------
CREATE INDEX IF NOT EXISTS idx_workspace_comments_user_id ON public.workspace_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_comments_author_id ON public.deliverable_comments(author_id);

-- >>> supabase/migrations/20261015000007_rls_storage_reconciliation.sql
-- ==============================================================================
-- FLOWDESK RLS: RECONCILED TABLES + SUPABASE STORAGE OBJECT POLICIES
-- Migration: 20261015000007_rls_storage_reconciliation.sql
-- Description: Enables RLS + least-privilege policies for the reconciled tables
--              (email_events, razorpay_orders) and installs storage.objects
--              policies for the five canonical buckets.
--
-- Storage path convention (enforced by src/backend/storage/storage-helper.ts):
--   Private buckets (documents, deliverables):
--     workspaces/<workspaceId>/clients/<clientId>/<uuid>_<filename>
--     workspaces/<workspaceId>/shared/<uuid>_<filename>
--   Public buckets (avatars, logos, signatures):
--     workspaces/<workspaceId>/branding/<uuid>_<filename>
--
-- NOTE: storage.objects is owned by supabase_storage_admin. On Supabase Cloud
-- the SQL editor / CLI migration role may not own storage.objects, so every
-- CREATE POLICY below is wrapped in an exception handler that degrades to a
-- NOTICE instead of aborting the migration. The bucket configuration itself is
-- always provisioned by migration 20261015000004_storage_buckets.sql.
-- ==============================================================================

-- 1. EMAIL EVENTS RLS ---------------------------------------------------------
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_events_select_owner" ON public.email_events;
CREATE POLICY "email_events_select_owner" ON public.email_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_owner(workspace_id));

-- Writes are performed exclusively by the trusted server layer (service role),
-- which bypasses RLS. No authenticated INSERT/UPDATE/DELETE policy is granted,
-- so the default is deny (mirrors the RLS matrix: AUDIT PROTECTED).

-- 2. RAZORPAY ORDERS RLS ------------------------------------------------------
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "razorpay_orders_select" ON public.razorpay_orders;
CREATE POLICY "razorpay_orders_select" ON public.razorpay_orders
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "razorpay_orders_manage_owner" ON public.razorpay_orders;
CREATE POLICY "razorpay_orders_manage_owner" ON public.razorpay_orders
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 3. STORAGE OBJECT POLICIES --------------------------------------------------
-- Encapsulated in an exception-safe block: if the executing role does not own
-- storage.objects (Supabase Cloud default), the migration records a notice and
-- continues. Buckets remain provisioned; privileged uploads still run through
-- the service-role server routes.
DO $storage_policies$
BEGIN
  -- 3a. Public buckets: world-readable (avatars, logos, signatures).
  DROP POLICY IF EXISTS "flowdesk_public_buckets_read" ON storage.objects;
  CREATE POLICY "flowdesk_public_buckets_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('avatars', 'logos', 'signatures'));

  -- 3b. Workspace owners: full control of their own workspace objects.
  DROP POLICY IF EXISTS "flowdesk_owner_manage_objects" ON storage.objects;
  CREATE POLICY "flowdesk_owner_manage_objects" ON storage.objects
    FOR ALL TO authenticated
    USING (
      bucket_id IN ('documents', 'deliverables', 'avatars', 'logos', 'signatures')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
    )
    WITH CHECK (
      bucket_id IN ('documents', 'deliverables', 'avatars', 'logos', 'signatures')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
    );

  -- 3c. Clients: read their own client-scoped document/deliverable objects.
  DROP POLICY IF EXISTS "flowdesk_client_read_objects" ON storage.objects;
  CREATE POLICY "flowdesk_client_read_objects" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id IN ('documents', 'deliverables')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );

  -- 3d. Clients: upload into their own client-scoped documents folder only.
  --     Clients may NOT write to deliverables (freelancer-owned output).
  DROP POLICY IF EXISTS "flowdesk_client_insert_documents" ON storage.objects;
  CREATE POLICY "flowdesk_client_insert_documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );

  -- 3e. Clients: overwrite their own client-scoped document objects on re-upload.
  DROP POLICY IF EXISTS "flowdesk_client_update_documents" ON storage.objects;
  CREATE POLICY "flowdesk_client_update_documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    )
    WITH CHECK (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped storage.objects policies (role does not own storage.objects). Apply these via the Supabase Dashboard Storage policy editor or the Supabase CLI.';
END
$storage_policies$;

-- >>> supabase/migrations/20261015000008_feature_contract.sql
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

-- >>> supabase/migrations/20261015000009_rpc_layer_and_receipts.sql
-- ==============================================================================
-- FLOWDESK RPC LAYER & RECEIPTS LEDGER (APPLICATION CONTRACT CLOSURE)
-- Migration: 20261015000009_rpc_layer_and_receipts.sql
--
-- Description: The application calls seven PostgreSQL functions through
--              supabase.rpc(...) and reads a `receipts` ledger through PostgREST
--              embedded joins. Neither existed in the version-controlled schema,
--              so the following features failed at runtime:
--
--                * record_manual_payment      -> offline/partial invoice settlement
--                * settle_razorpay_payment    -> online payment settlement (idempotent)
--                * claim_jobs / complete_job / fail_job
--                                             -> background job queue (recurring
--                                                invoices, reminders, email outbox)
--                * get_invitation_public_details / claim_client_invitation
--                                             -> client portal invitation flow
--                * receipts(*) embedded joins -> freelancer + client invoice reads,
--                                                payment status + receipt history
--
--              All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE)
--              so this migration is safe to re-run and is purely additive.
--              Nothing here drops or truncates application data.
--
-- SECURITY MODEL
--   * Every function is SECURITY DEFINER with `SET search_path = public`.
--   * Financial functions re-derive authorization themselves (owner / bound
--     client), because SECURITY DEFINER bypasses RLS.
--   * Queue functions and invitation functions are executable by
--     `service_role` only (they are invoked from trusted server routes).
-- ==============================================================================

-- ==============================================================================
-- 1. RECEIPTS LEDGER
--    Durable, per-payment receipt records read by:
--      src/backend/freelancer/index.ts (getInvoices)
--      src/backend/client/client-invoice-service.ts
--      src/backend/payments/payment-service.ts (getInvoicePaymentStatus)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_payment_id UUID REFERENCES public.invoice_payments(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'other',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_workspace_id ON public.receipts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client_id ON public.receipts(client_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON public.receipts(invoice_payment_id);

-- Receipt numbers are unique per workspace (mirrors invoice numbering).
ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS uq_receipts_workspace_number;
ALTER TABLE public.receipts ADD CONSTRAINT uq_receipts_workspace_number
  UNIQUE (workspace_id, receipt_number);

-- A single gateway payment may only ever produce one receipt (idempotency).
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_razorpay_payment
  ON public.receipts(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS chk_receipts_amount;
ALTER TABLE public.receipts ADD CONSTRAINT chk_receipts_amount
  CHECK (amount > 0);

-- Gateway payment idempotency: the same Razorpay payment id can never be
-- settled twice. payment-service.ts already handles the 23505 violation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_razorpay
  ON public.invoice_payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- 1b. RLS — mirrors invoice_payments: owners manage; bound clients may read
--     their own invoices' receipts. Writes happen through the SECURITY DEFINER
--     functions below (service role), never directly by clients.
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select" ON public.receipts;
CREATE POLICY "receipts_select" ON public.receipts
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

DROP POLICY IF EXISTS "receipts_manage_owner" ON public.receipts;
CREATE POLICY "receipts_manage_owner" ON public.receipts
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- ==============================================================================
-- 2. AUTHORIZATION HELPER FOR MONEY WRITES
--    SECURITY DEFINER money functions must validate the caller themselves.
--    Returns TRUE for the service role (auth.uid() IS NULL) and for the
--    workspace owner or a client portal identity bound to the invoice.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.can_settle_invoice(check_invoice_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN TRUE  -- trusted server / service_role
    ELSE EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = check_invoice_id
        AND (
          public.is_workspace_owner(i.workspace_id)
          OR i.client_id IN (SELECT public.get_auth_client_ids())
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.can_settle_invoice(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_settle_invoice(UUID) TO authenticated, service_role;

-- ==============================================================================
-- 3. record_manual_payment
--    Atomic offline / partial settlement.
--    Contract (from src/backend/freelancer/index.ts + app/api/.../offline/route.ts):
--      IN  p_invoice_id UUID, p_amount NUMERIC (NULL = settle full balance),
--          p_payment_method TEXT, p_notes TEXT
--      OUT jsonb { success, amountSettled, error?, errorCode?, ... }
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_remaining NUMERIC(12,2);
  v_amount NUMERIC(12,2);
  v_paid NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_payment_id UUID;
  v_receipt_id UUID;
  v_receipt_number TEXT;
  v_payment_status TEXT;
BEGIN
  IF p_invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_NOT_FOUND', 'error', 'Invoice not found.');
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_NOT_FOUND', 'error', 'Invoice not found.');
  END IF;

  IF NOT public.can_settle_invoice(v_inv.id) THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'UNAUTHORIZED',
      'error', 'You are not authorized to record payments for this invoice.');
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_CANCELLED',
      'error', 'This invoice has been cancelled and cannot accept payments.');
  END IF;

  v_total := ROUND(COALESCE(v_inv.total_amount, 0), 2);
  v_remaining := ROUND(v_total - COALESCE(v_inv.paid_amount, 0), 2);

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_ALREADY_PAID',
      'error', 'This invoice is already fully paid.');
  END IF;

  IF p_amount IS NULL THEN
    v_amount := v_remaining;
  ELSE
    IF p_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_AMOUNT',
        'error', 'Payment amount must be greater than zero.');
    END IF;
    IF ROUND(p_amount, 2) > v_remaining THEN
      RETURN jsonb_build_object('success', false, 'errorCode', 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
        'error', format('Payment amount (%s) exceeds the outstanding balance (%s).',
                        ROUND(p_amount, 2), v_remaining));
    END IF;
    v_amount := ROUND(p_amount, 2);
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, workspace_id, amount, currency, payment_method, payment_date,
    notes, gateway, gateway_status, captured_at
  ) VALUES (
    v_inv.id, v_inv.workspace_id, v_amount, COALESCE(v_inv.currency, 'USD'),
    COALESCE(NULLIF(p_payment_method, ''), 'bank_transfer'), now(),
    p_notes, 'manual', 'completed', now()
  ) RETURNING id INTO v_payment_id;

  v_receipt_number := 'RCP-' || COALESCE(v_inv.invoice_number, 'INV') || '-'
    || UPPER(SUBSTRING(REPLACE(v_payment_id::text, '-', '') FROM 1 FOR 8));

  INSERT INTO public.receipts (
    workspace_id, client_id, invoice_id, invoice_payment_id, receipt_number,
    amount, currency, payment_method, payment_date, notes
  ) VALUES (
    v_inv.workspace_id, v_inv.client_id, v_inv.id, v_payment_id, v_receipt_number,
    v_amount, COALESCE(v_inv.currency, 'USD'),
    COALESCE(NULLIF(p_payment_method, ''), 'bank_transfer'), now(), p_notes
  ) RETURNING id INTO v_receipt_id;

  v_paid := ROUND(COALESCE(v_inv.paid_amount, 0) + v_amount, 2);
  v_payment_status := CASE WHEN v_paid >= v_total THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.invoices
     SET paid_amount = v_paid,
         payment_status = v_payment_status,
         status = v_payment_status,
         updated_at = now()
   WHERE id = v_inv.id;

  INSERT INTO public.activities (
    workspace_id, client_id, project_id, action, title, description,
    user_name, resource_type, resource_id, metadata
  ) VALUES (
    v_inv.workspace_id, v_inv.client_id, v_inv.project_id, 'recorded_payment',
    COALESCE(v_inv.invoice_number, 'Invoice'),
    format('Payment of %s %s recorded (%s).', COALESCE(v_inv.currency, 'USD'), v_amount,
           COALESCE(NULLIF(p_payment_method, ''), 'bank_transfer')),
    'FlowDesk', 'invoice', v_inv.id::text,
    jsonb_build_object(
      'paymentId', v_payment_id, 'receiptId', v_receipt_id,
      'amount', v_amount, 'paymentStatus', v_payment_status
    )
  );

  INSERT INTO public.notifications (
    workspace_id, client_id, user_id, title, message, type, category, link, priority, read
  )
  SELECT v_inv.workspace_id, v_inv.client_id, w.owner_id, 'Payment Received',
         format('Payment of %s %s recorded for invoice %s.',
                COALESCE(v_inv.currency, 'USD'), v_amount, COALESCE(v_inv.invoice_number, '')),
         'success', 'invoice', 'invoices', 'medium', false
    FROM public.workspaces w
   WHERE w.id = v_inv.workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoiceId', v_inv.id,
    'invoiceNumber', v_inv.invoice_number,
    'paymentId', v_payment_id,
    'receiptId', v_receipt_id,
    'receiptNumber', v_receipt_number,
    'amountSettled', v_amount,
    'paidAmount', v_paid,
    'totalAmount', v_total,
    'remainingBalance', GREATEST(0, ROUND(v_total - v_paid, 2)),
    'status', v_payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- 4. settle_razorpay_payment
--    Idempotent online settlement for a captured Razorpay payment.
--    Contract (from src/backend/payments/payment-service.ts):
--      p_razorpay_payment_id, p_razorpay_order_id, p_razorpay_signature,
--      p_amount, p_currency, p_payment_method, p_captured_at,
--      p_expected_invoice_id, p_expected_client_id, p_notes
--      OUT jsonb matching PaymentProcessResult
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.settle_razorpay_payment(
  p_razorpay_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_razorpay_signature TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'USD',
  p_payment_method TEXT DEFAULT 'razorpay',
  p_captured_at TIMESTAMPTZ DEFAULT now(),
  p_expected_invoice_id UUID DEFAULT NULL,
  p_expected_client_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.invoice_payments%ROWTYPE;
  v_order public.razorpay_orders%ROWTYPE;
  v_has_order BOOLEAN := FALSE;
  v_inv public.invoices%ROWTYPE;
  v_invoice_id UUID;
  v_remaining NUMERIC(12,2);
  v_amount NUMERIC(12,2);
  v_paid NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_payment_id UUID;
  v_receipt_id UUID;
  v_receipt_number TEXT;
  v_payment_status TEXT;
  v_receipt JSONB;
BEGIN
  IF p_razorpay_payment_id IS NULL OR p_razorpay_payment_id = '' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_PAYMENT',
      'error', 'Razorpay payment id is required for settlement.');
  END IF;

  -- Idempotency: this payment id has already been settled.
  SELECT * INTO v_existing
    FROM public.invoice_payments
   WHERE razorpay_payment_id = p_razorpay_payment_id
   LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_inv FROM public.invoices WHERE id = v_existing.invoice_id;
    SELECT jsonb_build_object(
             'id', r.id, 'receiptNumber', r.receipt_number, 'invoiceId', r.invoice_id,
             'invoiceNumber', v_inv.invoice_number, 'amount', r.amount,
             'currency', r.currency, 'paymentMethod', r.payment_method,
             'paymentDate', r.payment_date
           )
      INTO v_receipt
      FROM public.receipts r
     WHERE r.invoice_payment_id = v_existing.id
     ORDER BY r.created_at ASC
     LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'duplicateSuppressed', true,
      'alreadyProcessed', true,
      'paymentId', p_razorpay_payment_id,
      'dbPaymentId', v_existing.id,
      'orderId', COALESCE(p_razorpay_order_id, v_existing.razorpay_order_id),
      'invoiceId', v_existing.invoice_id,
      'invoiceNumber', v_inv.invoice_number,
      'workspaceId', v_inv.workspace_id,
      'clientId', v_inv.client_id,
      'clientName', v_inv.client_name,
      'clientEmail', v_inv.client_email,
      'status', COALESCE(v_inv.payment_status, 'paid'),
      'amountSettled', v_existing.amount,
      'totalAmount', COALESCE(v_inv.total_amount, 0),
      'paidAmount', COALESCE(v_inv.paid_amount, 0),
      'remainingBalance', GREATEST(0, ROUND(COALESCE(v_inv.total_amount, 0) - COALESCE(v_inv.paid_amount, 0), 2)),
      'receipt', v_receipt
    );
  END IF;

  -- Resolve the order ledger row (it maps order_id -> invoice).
  IF p_razorpay_order_id IS NOT NULL THEN
    SELECT * INTO v_order
      FROM public.razorpay_orders
     WHERE order_id = p_razorpay_order_id
     FOR UPDATE;
    v_has_order := FOUND;
  END IF;

  v_invoice_id := COALESCE(p_expected_invoice_id, v_order.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'UNRESOLVED_PAYMENT',
      'error', 'Unable to safely associate this payment with an invoice.');
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = v_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_NOT_FOUND',
      'error', 'Invoice not found for this payment.');
  END IF;

  IF NOT public.can_settle_invoice(v_inv.id) THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'UNAUTHORIZED',
      'error', 'Unauthorized: invoice does not belong to this client session.');
  END IF;

  IF p_expected_client_id IS NOT NULL AND v_inv.client_id IS NOT NULL
     AND v_inv.client_id <> p_expected_client_id THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'UNAUTHORIZED',
      'error', 'Unauthorized: invoice does not belong to this client session.');
  END IF;

  v_total := ROUND(COALESCE(v_inv.total_amount, 0), 2);
  v_remaining := ROUND(v_total - COALESCE(v_inv.paid_amount, 0), 2);

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_ALREADY_PAID',
      'error', 'This invoice is already fully paid.');
  END IF;

  v_amount := ROUND(COALESCE(p_amount, v_remaining), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_AMOUNT',
      'error', 'Payment amount must be greater than zero.');
  END IF;
  IF v_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      'error', format('Payment amount (%s) exceeds the outstanding balance (%s).', v_amount, v_remaining));
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, workspace_id, amount, currency, payment_method, payment_date,
    razorpay_payment_id, razorpay_order_id, razorpay_signature,
    gateway, gateway_status, captured_at, notes
  ) VALUES (
    v_inv.id, v_inv.workspace_id, v_amount, UPPER(COALESCE(p_currency, COALESCE(v_inv.currency, 'USD'))),
    COALESCE(NULLIF(p_payment_method, ''), 'razorpay'), COALESCE(p_captured_at, now()),
    p_razorpay_payment_id, p_razorpay_order_id, p_razorpay_signature,
    'razorpay', 'completed', COALESCE(p_captured_at, now()), p_notes
  ) RETURNING id INTO v_payment_id;

  v_receipt_number := 'RCP-' || COALESCE(v_inv.invoice_number, 'INV') || '-'
    || UPPER(SUBSTRING(REPLACE(v_payment_id::text, '-', '') FROM 1 FOR 8));

  INSERT INTO public.receipts (
    workspace_id, client_id, invoice_id, invoice_payment_id, receipt_number,
    amount, currency, payment_method, payment_date,
    razorpay_payment_id, razorpay_order_id, notes
  ) VALUES (
    v_inv.workspace_id, v_inv.client_id, v_inv.id, v_payment_id, v_receipt_number,
    v_amount, UPPER(COALESCE(p_currency, COALESCE(v_inv.currency, 'USD'))),
    COALESCE(NULLIF(p_payment_method, ''), 'razorpay'), COALESCE(p_captured_at, now()),
    p_razorpay_payment_id, p_razorpay_order_id, p_notes
  ) RETURNING id INTO v_receipt_id;

  v_paid := ROUND(COALESCE(v_inv.paid_amount, 0) + v_amount, 2);
  v_payment_status := CASE WHEN v_paid >= v_total THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.invoices
     SET paid_amount = v_paid,
         payment_status = v_payment_status,
         status = v_payment_status,
         updated_at = now()
   WHERE id = v_inv.id;

  IF v_has_order THEN
    UPDATE public.razorpay_orders
       SET status = 'paid', updated_at = now()
     WHERE id = v_order.id;
  END IF;

  INSERT INTO public.activities (
    workspace_id, client_id, project_id, action, title, description,
    user_name, resource_type, resource_id, metadata
  ) VALUES (
    v_inv.workspace_id, v_inv.client_id, v_inv.project_id, 'recorded_payment',
    COALESCE(v_inv.invoice_number, 'Invoice'),
    format('Online payment of %s %s settled.', UPPER(COALESCE(p_currency, 'USD')), v_amount),
    'FlowDesk', 'invoice', v_inv.id::text,
    jsonb_build_object(
      'paymentId', v_payment_id, 'receiptId', v_receipt_id,
      'razorpayPaymentId', p_razorpay_payment_id,
      'gateway', 'razorpay', 'paymentStatus', v_payment_status
    )
  );

  INSERT INTO public.notifications (
    workspace_id, client_id, user_id, title, message, type, category, link, priority, read
  )
  SELECT v_inv.workspace_id, v_inv.client_id, w.owner_id, 'Invoice Paid',
         format('Invoice %s was paid online (%s %s).',
                COALESCE(v_inv.invoice_number, ''), UPPER(COALESCE(p_currency, 'USD')), v_amount),
         'success', 'invoice', 'invoices', 'medium', false
    FROM public.workspaces w
   WHERE w.id = v_inv.workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'paymentId', p_razorpay_payment_id,
    'dbPaymentId', v_payment_id,
    'orderId', p_razorpay_order_id,
    'invoiceId', v_inv.id,
    'invoiceNumber', v_inv.invoice_number,
    'workspaceId', v_inv.workspace_id,
    'clientId', v_inv.client_id,
    'clientName', v_inv.client_name,
    'clientEmail', v_inv.client_email,
    'status', v_payment_status,
    'amountSettled', v_amount,
    'totalAmount', v_total,
    'paidAmount', v_paid,
    'remainingBalance', GREATEST(0, ROUND(v_total - v_paid, 2)),
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'receiptNumber', v_receipt_number,
      'invoiceId', v_inv.id,
      'invoiceNumber', v_inv.invoice_number,
      'amount', v_amount,
      'currency', UPPER(COALESCE(p_currency, 'USD')),
      'paymentMethod', COALESCE(NULLIF(p_payment_method, ''), 'razorpay'),
      'paymentDate', COALESCE(p_captured_at, now()),
      'totalAmount', v_total,
      'remainingBalance', GREATEST(0, ROUND(v_total - v_paid, 2))
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- 5. BACKGROUND JOB QUEUE (src/backend/jobs/runner.ts — service role only)
-- ==============================================================================

-- 5a. Atomically lease a batch of due jobs.
CREATE OR REPLACE FUNCTION public.claim_jobs(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT array_agg(s.id) INTO v_ids
    FROM (
      SELECT j.id
        FROM public.jobs j
       WHERE j.attempts < j.max_attempts
         AND (
           (j.status = 'queued' AND j.run_at <= now())
           OR (j.status = 'running' AND (j.locked_until IS NULL OR j.locked_until < now()))
         )
       ORDER BY j.run_at ASC, j.created_at ASC
       LIMIT GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 200))
         FOR UPDATE SKIP LOCKED
    ) s;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.jobs j
     SET status = 'running',
         locked_by = p_worker_id,
         locked_until = now() + make_interval(secs => GREATEST(1, COALESCE(p_lease_seconds, 60))),
         attempts = j.attempts + 1,
         updated_at = now()
   WHERE j.id = ANY(v_ids)
  RETURNING j.*;
END;
$$;

-- 5b. Mark a leased job succeeded + record the run.
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_duration_ms INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_duration INTEGER := GREATEST(0, COALESCE(p_duration_ms, 0));
BEGIN
  UPDATE public.jobs
     SET status = 'succeeded',
         locked_by = NULL,
         locked_until = NULL,
         last_error = NULL,
         finished_at = now(),
         updated_at = now()
   WHERE id = p_job_id
     AND (locked_by IS NULL OR locked_by = p_worker_id)
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job lease is not held by this worker.');
  END IF;

  INSERT INTO public.job_runs (
    job_id, workspace_id, attempt_number, status, worker_id, duration_ms, started_at, completed_at
  ) VALUES (
    v_job.id, v_job.workspace_id, GREATEST(1, v_job.attempts), 'succeeded',
    COALESCE(NULLIF(p_worker_id, ''), 'unknown'), v_duration,
    now() - make_interval(secs => v_duration / 1000.0), now()
  );

  RETURN jsonb_build_object('success', true, 'jobId', v_job.id, 'status', 'succeeded');
END;
$$;

-- 5c. Mark a leased job failed (requeue with backoff) or dead (exhausted).
CREATE OR REPLACE FUNCTION public.fail_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_duration_ms INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL,
  p_next_run_at TIMESTAMPTZ DEFAULT NULL,
  p_dead BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_duration INTEGER := GREATEST(0, COALESCE(p_duration_ms, 0));
BEGIN
  UPDATE public.jobs
     SET status = CASE WHEN p_dead THEN 'dead' ELSE 'queued' END,
         locked_by = NULL,
         locked_until = NULL,
         last_error = p_error_message,
         run_at = CASE WHEN p_dead THEN run_at ELSE COALESCE(p_next_run_at, now()) END,
         finished_at = CASE WHEN p_dead THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_job_id
     AND (locked_by IS NULL OR locked_by = p_worker_id)
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job lease is not held by this worker.');
  END IF;

  INSERT INTO public.job_runs (
    job_id, workspace_id, attempt_number, status, worker_id, duration_ms,
    error_message, started_at, completed_at
  ) VALUES (
    v_job.id, v_job.workspace_id, GREATEST(1, v_job.attempts),
    CASE WHEN p_dead THEN 'dead' ELSE 'failed' END,
    COALESCE(NULLIF(p_worker_id, ''), 'unknown'), v_duration,
    p_error_message, now() - make_interval(secs => v_duration / 1000.0), now()
  );

  RETURN jsonb_build_object('success', true, 'jobId', v_job.id, 'dead', p_dead);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_job(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- ==============================================================================
-- 6. CLIENT PORTAL INVITATIONS (server routes only — service_role)
-- ==============================================================================

-- 6a. Public (non-identifying) invitation preview used by GET /api/invitations/[token].
CREATE OR REPLACE FUNCTION public.get_invitation_public_details(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.client_invitations%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_owner_name TEXT;
  v_email TEXT;
  v_local TEXT;
  v_domain TEXT;
  v_masked TEXT;
  v_result JSONB;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) < 10 THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'invalid',
      'error', 'This connection link is invalid or incomplete.');
  END IF;

  SELECT * INTO v_inv FROM public.client_invitations WHERE token_hash = p_token_hash LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'invalid',
      'error', 'This connection link is invalid or does not exist.');
  END IF;

  IF v_inv.status = 'claimed' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'claimed',
      'error', 'This connection link has already been used.');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'revoked',
      'error', 'This connection link has been revoked by the sender.');
  END IF;

  IF v_inv.status = 'expired' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'expired',
      'error', 'This connection link has expired.');
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('isValid', false, 'status', 'expired',
      'error', 'This connection link has expired.');
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_inv.client_id;

  SELECT COALESCE(NULLIF(p.business_name, ''), NULLIF(p.full_name, ''), 'FlowDesk Studio')
    INTO v_owner_name
    FROM public.profiles p
   WHERE p.id = v_inv.freelancer_id;

  v_email := COALESCE(v_inv.recipient_email, v_client.email);
  IF v_email IS NOT NULL AND position('@' IN v_email) > 0 THEN
    v_local := split_part(v_email, '@', 1);
    v_domain := split_part(v_email, '@', 2);
    v_masked := CASE
      WHEN length(v_local) <= 2 THEN left(v_local, 1) || '***@' || v_domain
      ELSE left(v_local, 1) || '***' || right(v_local, 1) || '@' || v_domain
    END;
  END IF;

  v_result := jsonb_build_object(
    'isValid', true,
    'status', 'pending',
    'freelancerName', COALESCE(v_owner_name, 'FlowDesk Studio'),
    'clientName', COALESCE(NULLIF(v_client.name, ''), 'Client'),
    'companyName', COALESCE(v_client.company, ''),
    'expiresAt', v_inv.expires_at
  );

  IF v_masked IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('maskedEmail', v_masked);
  END IF;

  RETURN v_result;
END;
$$;

-- 6b. Atomically claim an invitation (single-use) and bind the client identity.
CREATE OR REPLACE FUNCTION public.claim_client_invitation(
  p_token_hash TEXT,
  p_user_id UUID,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.client_invitations%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_bound_id UUID;
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_TOKEN',
      'error', 'Missing required token or user identification.');
  END IF;

  SELECT * INTO v_inv
    FROM public.client_invitations
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_TOKEN',
      'error', 'This connection link is invalid or does not exist.');
  END IF;

  -- Idempotency check: If this invitation was already claimed by the exact same user, return success
  IF v_inv.status = 'claimed' THEN
    IF v_inv.claimed_by_user_id = p_user_id THEN
      SELECT * INTO v_client FROM public.clients WHERE id = v_inv.client_id;
      RETURN jsonb_build_object(
        'success', true,
        'clientId', v_client.id,
        'workspaceId', v_client.workspace_id,
        'clientName', v_client.name,
        'company', v_client.company,
        'message', 'Connection already established.'
      );
    END IF;

    RETURN jsonb_build_object('success', false, 'errorCode', 'ALREADY_CLAIMED',
      'error', 'This connection link has already been used.');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'REVOKED',
      'error', 'This connection link has been revoked by the sender.');
  END IF;

  IF v_inv.status = 'expired' OR (v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()) THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', false, 'errorCode', 'EXPIRED',
      'error', 'This connection link has expired.');
  END IF;

  IF v_inv.recipient_email IS NOT NULL AND p_user_email IS NOT NULL
     AND lower(trim(p_user_email)) <> lower(trim(v_inv.recipient_email)) THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'EMAIL_MISMATCH',
      'error', 'The email address of your account does not match the invitation.');
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_inv.client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_NOT_FOUND',
      'error', 'Associated client record not found.');
  END IF;

  IF v_client.user_id IS NOT NULL AND v_client.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_ALREADY_CONNECTED',
      'error', 'This client connection has already been completed by another user.');
  END IF;

  UPDATE public.clients
     SET user_id = p_user_id,
         status = 'active',
         updated_at = now()
   WHERE id = v_client.id
     AND (user_id IS NULL OR user_id = p_user_id)
  RETURNING id INTO v_bound_id;

  IF v_bound_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_ALREADY_CONNECTED',
      'error', 'This client connection has already been completed by another user.');
  END IF;

  UPDATE public.client_invitations
     SET status = 'claimed', claimed_at = now(), claimed_by_user_id = p_user_id
   WHERE id = v_inv.id;

  -- Synchronously upsert client_connections to reconcile with permanent portal link
  INSERT INTO public.client_connections (
    workspace_id,
    freelancer_user_id,
    client_user_id,
    client_id,
    status,
    connected_at
  ) VALUES (
    v_client.workspace_id,
    v_inv.freelancer_id,
    p_user_id,
    v_client.id,
    'active',
    now()
  )
  ON CONFLICT (client_user_id, workspace_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    status = 'active',
    disconnected_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'clientId', v_client.id,
    'workspaceId', v_client.workspace_id,
    'clientName', v_client.name,
    'company', v_client.company,
    'message', 'Connection established successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_public_details(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_client_invitation(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_public_details(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_client_invitation(TEXT, UUID, TEXT) TO service_role;

-- ==============================================================================
-- 10. PERMANENT CLIENT PORTAL LINK & MULTI-FREELANCER CONNECTIONS
-- Migration: 20261015000010_permanent_portal_link.sql
-- ==============================================================================

-- 1. ADD PORTAL SLUG AND CONNECTION SETTINGS TO WORKSPACES
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS portal_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_accepting_connections BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing workspaces that do not yet have a portal_slug
UPDATE public.workspaces
SET portal_slug = 'fd_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16))
WHERE portal_slug IS NULL OR portal_slug = '';

ALTER TABLE public.workspaces
  ALTER COLUMN portal_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_portal_slug ON public.workspaces(portal_slug);

CREATE OR REPLACE FUNCTION public.generate_workspace_portal_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_slug IS NULL OR NEW.portal_slug = '' THEN
    NEW.portal_slug := 'fd_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_portal_slug ON public.workspaces;
CREATE TRIGGER trg_workspace_portal_slug
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_workspace_portal_slug();

-- 2. CLIENT CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.client_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  freelancer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'pending')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_workspace_connection UNIQUE (client_user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_client_conn_workspace_id ON public.client_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_client_user_id ON public.client_connections(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_freelancer_user_id ON public.client_connections(freelancer_user_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_client_id ON public.client_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_status ON public.client_connections(status);

INSERT INTO public.client_connections (workspace_id, freelancer_user_id, client_user_id, client_id, status, connected_at)
SELECT
  c.workspace_id,
  w.owner_id,
  c.user_id,
  c.id,
  'active',
  c.created_at
FROM public.clients c
JOIN public.workspaces w ON w.id = c.workspace_id
WHERE c.user_id IS NOT NULL
  AND c.status != 'pending_deletion'
  AND c.deleted_at IS NULL
ON CONFLICT (client_user_id, workspace_id) DO NOTHING;

ALTER TABLE public.client_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_connections_select" ON public.client_connections;
CREATE POLICY "client_connections_select" ON public.client_connections
  FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_insert" ON public.client_connections;
CREATE POLICY "client_connections_insert" ON public.client_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    client_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_update" ON public.client_connections;
CREATE POLICY "client_connections_update" ON public.client_connections
  FOR UPDATE TO authenticated
  USING (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  )
  WITH CHECK (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_delete" ON public.client_connections;
CREATE POLICY "client_connections_delete" ON public.client_connections
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
    AND status != 'pending_deletion'
  UNION
  SELECT client_id FROM public.client_connections
  WHERE client_user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(check_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    LEFT JOIN public.client_connections cc ON cc.client_id = c.id
    WHERE c.id = check_client_id
      AND (c.user_id = auth.uid() OR (cc.client_user_id = auth.uid() AND cc.status = 'active'))
      AND c.status != 'pending_deletion'
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_freelancer_portal(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws RECORD;
  v_prof RECORD;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 3 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid portal identifier format');
  END IF;

  SELECT w.id, w.owner_id, w.name, w.logo_url, w.currency, w.is_accepting_connections
  INTO v_ws
  FROM public.workspaces w
  WHERE lower(w.portal_slug) = lower(trim(p_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Freelancer portal not found');
  END IF;

  SELECT p.full_name, p.business_name, p.profession, p.avatar_url, p.logo_url
  INTO v_prof
  FROM public.profiles p
  WHERE p.id = v_ws.owner_id;

  RETURN jsonb_build_object(
    'valid', true,
    'slug', trim(p_slug),
    'is_accepting_connections', v_ws.is_accepting_connections,
    'freelancer_name', COALESCE(v_prof.full_name, 'FlowDesk Freelancer'),
    'studio_name', COALESCE(v_ws.name, v_prof.business_name, 'Studio Workspace'),
    'profession', COALESCE(v_prof.profession, 'Independent Professional'),
    'avatar_url', COALESCE(v_prof.avatar_url, ''),
    'logo_url', COALESCE(v_ws.logo_url, v_prof.logo_url, ''),
    'currency', COALESCE(v_ws.currency, 'USD')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_freelancer_portal(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.connect_client_to_workspace(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_email TEXT;
  v_caller_name TEXT;
  v_ws RECORD;
  v_client_id UUID;
  v_existing_conn RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to connect workspace');
  END IF;

  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_caller_email, v_caller_name
  FROM auth.users
  WHERE id = v_caller_id;

  SELECT w.id, w.owner_id, w.name, w.is_accepting_connections
  INTO v_ws
  FROM public.workspaces w
  WHERE lower(w.portal_slug) = lower(trim(p_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freelancer portal link does not exist');
  END IF;

  IF NOT v_ws.is_accepting_connections THEN
    RETURN jsonb_build_object('success', false, 'error', 'This freelancer is not currently accepting new connections');
  END IF;

  IF v_ws.owner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot connect to your own workspace as a client');
  END IF;

  SELECT cc.id, cc.client_id, cc.status
  INTO v_existing_conn
  FROM public.client_connections cc
  WHERE cc.client_user_id = v_caller_id
    AND cc.workspace_id = v_ws.id;

  IF FOUND THEN
    IF v_existing_conn.status = 'active' THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_connected', true,
        'client_id', v_existing_conn.client_id,
        'workspace_id', v_ws.id,
        'studio_name', v_ws.name
      );
    ELSE
      UPDATE public.client_connections
      SET status = 'active', disconnected_at = NULL, updated_at = now()
      WHERE id = v_existing_conn.id;

      RETURN jsonb_build_object(
        'success', true,
        'reconnected', true,
        'client_id', v_existing_conn.client_id,
        'workspace_id', v_ws.id,
        'studio_name', v_ws.name
      );
    END IF;
  END IF;

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE workspace_id = v_ws.id
    AND user_id = v_caller_id
    AND status != 'pending_deletion'
  LIMIT 1;

  IF v_client_id IS NULL AND v_caller_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND user_id IS NULL
      AND lower(email) = lower(v_caller_email)
      AND status != 'pending_deletion'
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      UPDATE public.clients
      SET user_id = v_caller_id, updated_at = now()
      WHERE id = v_client_id;
    END IF;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      workspace_id,
      user_id,
      name,
      company,
      email,
      status,
      currency
    ) VALUES (
      v_ws.id,
      v_caller_id,
      COALESCE(v_caller_name, split_part(v_caller_email, '@', 1), 'Client Partner'),
      COALESCE(v_caller_name || ' Workspace', 'Client Organization'),
      COALESCE(v_caller_email, 'client@flowdesk.app'),
      'active',
      'USD'
    ) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO public.client_connections (
    workspace_id,
    freelancer_user_id,
    client_user_id,
    client_id,
    status
  ) VALUES (
    v_ws.id,
    v_ws.owner_id,
    v_caller_id,
    v_client_id,
    'active'
  )
  ON CONFLICT (client_user_id, workspace_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    status = 'active',
    disconnected_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id,
    'workspace_id', v_ws.id,
    'studio_name', v_ws.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_client_to_workspace(TEXT) TO authenticated, service_role;

