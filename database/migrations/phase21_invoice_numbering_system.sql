-- Phase 21: Invoice Numbering System & Format Customization
-- 1. Add invoice numbering configuration columns to user_settings
-- 2. Add invoice_sequences table for atomic concurrency-safe sequential tracking
-- 3. Ensure uniqueness constraints on (workspace_id, invoice_number)

-- ============================================================
-- 1. USER_SETTINGS NUMBERING CONFIGURATION
-- ============================================================
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_number_format TEXT DEFAULT 'prefix_year_sequence';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_separator TEXT DEFAULT '-';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_include_year BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_padding INTEGER DEFAULT 4;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_next_sequence INTEGER DEFAULT 1;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS invoice_annual_reset BOOLEAN DEFAULT false;

-- ============================================================
-- 2. INVOICE SEQUENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'INV',
  year INTEGER,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, prefix, year)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Drop existing sequence policies if any (idempotent)
DROP POLICY IF EXISTS "Workspace members can access invoice sequences" ON public.invoice_sequences;

-- Workspace-owner scoped access (uses the actual workspaces.owner_id column;
-- workspace_members does not exist in this schema)
CREATE POLICY "Workspace members can access invoice sequences" ON public.invoice_sequences
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- ============================================================
-- 3. INDEX & UNIQUE CONSTRAINT VERIFICATION
-- ============================================================
-- The workspace-scoped unique constraint is created in phase20. If it is missing
-- (e.g. partial migration), create it here. Only duplicate-object errors are
-- swallowed so real failures surface loudly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_workspace_invoice_number_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_workspace_invoice_number'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_workspace_invoice_number_unique UNIQUE (workspace_id, invoice_number);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_column THEN NULL;
END $$;
