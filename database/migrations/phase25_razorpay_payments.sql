-- Phase 25: Razorpay Payment Gateway Integration
-- Adds gateway tracking fields to invoice_payments and creates razorpay_orders table

-- ============================================================
-- 1. INVOICE_PAYMENTS: Add gateway & reconciliation columns
-- ============================================================
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'manual';
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS gateway_status TEXT DEFAULT 'completed';
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Enforce database-level idempotency for online payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_razorpay_payment_id
  ON public.invoice_payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_razorpay_order_id
  ON public.invoice_payments (razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_gateway
  ON public.invoice_payments (gateway);

-- ============================================================
-- 2. RAZORPAY_ORDERS: Payment Intent & Order Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  amount_subunits BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'created', -- 'created', 'attempted', 'paid', 'failed', 'expired'
  receipt TEXT NOT NULL,
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_invoice_id
  ON public.razorpay_orders (invoice_id);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_workspace_id
  ON public.razorpay_orders (workspace_id);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_client_id
  ON public.razorpay_orders (client_id);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id
  ON public.razorpay_orders (order_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR RAZORPAY_ORDERS
-- ============================================================
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

-- Freelancer (workspace owner): full access to own workspace orders
CREATE POLICY "freelancer_select_razorpay_orders"
  ON public.razorpay_orders FOR SELECT
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "freelancer_insert_razorpay_orders"
  ON public.razorpay_orders FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "freelancer_update_razorpay_orders"
  ON public.razorpay_orders FOR UPDATE
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- Client: SELECT only for orders tied to their client record
CREATE POLICY "client_select_razorpay_orders"
  ON public.razorpay_orders FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.get_auth_client_ids())
  );
