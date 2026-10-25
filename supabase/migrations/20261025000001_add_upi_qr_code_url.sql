-- Migration: 20261025000001_add_upi_qr_code_url.sql
-- Description: Adds upi_qr_code_url to invoices, user_settings, and profiles
--              to allow direct QR code image upload and display across invoices.

-- 1. Extend public.invoices with direct uploaded UPI QR code URL
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS upi_qr_code_url TEXT;

-- 2. Extend public.user_settings with default uploaded UPI QR code URL
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS upi_qr_code_url TEXT;

-- 3. Extend public.profiles with uploaded UPI QR code URL
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS upi_qr_code_url TEXT;

-- 4. Audit comments
COMMENT ON COLUMN public.invoices.upi_qr_code_url IS 'Direct uploaded UPI/Payment QR code image URL for invoice display';
COMMENT ON COLUMN public.user_settings.upi_qr_code_url IS 'Default uploaded UPI/Payment QR code image URL for freelancer settings';
COMMENT ON COLUMN public.profiles.upi_qr_code_url IS 'Uploaded UPI/Payment QR code image URL associated with freelancer profile';
