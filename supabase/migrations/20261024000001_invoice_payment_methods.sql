-- Migration: 20261024000001_invoice_payment_methods.sql
-- Description: Adds dual payment methods (manual instructions, UPI, Bank Transfer, Razorpay Payment Link) 
--              and client payment notification metadata to invoices and freelancer user settings.

-- 1. Extend public.invoices with payment method configurations & client notification tracking
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{"bankTransferEnabled": true, "upiEnabled": false, "razorpayLinkEnabled": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_details JSONB,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS payment_notification JSONB;

-- 2. Extend public.user_settings with default payment configurations for freelancers
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
  ADD COLUMN IF NOT EXISTS branch_name TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link TEXT;

-- 3. Indexes for efficient lookup of invoices by payment status and awaiting verification
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices (payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_notification_status ON public.invoices USING gin (payment_notification) 
  WHERE payment_notification IS NOT NULL;

-- 4. Audit comment
COMMENT ON COLUMN public.invoices.payment_methods IS 'Toggles and configuration for enabled payment methods on this invoice';
COMMENT ON COLUMN public.invoices.upi_id IS 'Freelancers UPI VPA for direct QR / UPI payment';
COMMENT ON COLUMN public.invoices.bank_details IS 'Structured bank account information (account holder, bank name, account number, IFSC, branch)';
COMMENT ON COLUMN public.invoices.razorpay_payment_link IS 'External HTTPS Razorpay Payment Link owned by freelancer';
COMMENT ON COLUMN public.invoices.payment_notification IS 'Client submitted payment verification request (transaction ref, date, amount, status)';
