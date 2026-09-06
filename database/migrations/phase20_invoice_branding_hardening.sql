-- Phase 20: Invoice Branding, Numbering Constraints, and Hardening
-- Adds signature_url to workspaces and profiles
-- Adds workspace-scoped unique constraint for invoice numbers
-- Adds numerical constraints for invoice integrity

-- 1. WORKSPACES: Add signature_url
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- 2. PROFILES: Add signature_url and ensure logo_url compatibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 3. INVOICES: Workspace-scoped Unique Constraint
-- Ensures no two invoices in the same workspace have duplicate numbers.
-- Only duplicate-object errors are swallowed so genuine failures surface loudly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_workspace_invoice_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_workspace_invoice_number_unique'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT unique_workspace_invoice_number UNIQUE (workspace_id, invoice_number);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_column THEN NULL;
END $$;

-- 4. INVOICES & ITEMS: Integrity Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_paid_amount_non_negative') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_paid_amount_non_negative CHECK (paid_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_discount_non_negative') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_discount_non_negative CHECK (discount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_tax_percentage_non_negative') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_tax_percentage_non_negative CHECK (tax_percentage >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_items_quantity_positive') THEN
    ALTER TABLE public.invoice_items ADD CONSTRAINT chk_invoice_items_quantity_positive CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_items_unit_price_non_negative') THEN
    ALTER TABLE public.invoice_items ADD CONSTRAINT chk_invoice_items_unit_price_non_negative CHECK (unit_price >= 0);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_column THEN NULL;
END $$;
