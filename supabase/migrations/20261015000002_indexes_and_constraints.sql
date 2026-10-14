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
