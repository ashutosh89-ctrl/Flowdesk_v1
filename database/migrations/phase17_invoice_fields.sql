-- Phase 17: Add Missing Invoice Fields
-- Adds discount, payment_instructions, tax_name, internal_notes columns to invoices table
-- Adds payment_date to invoice_payments table

-- ============================================================
-- 1. INVOICES: Add missing columns
-- ============================================================

-- Discount amount (numeric, defaults to 0)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

-- Tax label name (e.g., 'GST', 'VAT', 'Sales Tax')
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'Tax';

-- Payment instructions shown to client
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_instructions TEXT DEFAULT '';

-- Internal notes (never shown to client)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '';

-- ============================================================
-- 2. INVOICE_PAYMENTS: Add payment_date column
-- ============================================================

-- Payment timestamp (when the payment was actually made)
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- ============================================================
-- 3. Update default tax_name from existing data
-- ============================================================
-- Set tax_name to 'Tax' for existing invoices that don't have it
UPDATE public.invoices SET tax_name = 'Tax' WHERE tax_name IS NULL;
