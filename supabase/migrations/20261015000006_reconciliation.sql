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
