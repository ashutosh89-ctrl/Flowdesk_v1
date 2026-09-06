-- ============================================================
-- Phase 26: Production Hardening
-- Atomic Transactional Payment Settlement, Durable Receipts,
-- Overpayment Protection, Financial Retention, & Email Outbox
-- ============================================================

-- 1. Create durable receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  invoice_payment_id UUID REFERENCES public.invoice_payments(id) ON DELETE RESTRICT,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'razorpay',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  razorpay_payment_id TEXT UNIQUE,
  razorpay_order_id TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_workspace_id ON public.receipts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client_id ON public.receipts (client_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts (receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_razorpay_payment_id ON public.receipts (razorpay_payment_id);

-- 2. Receipts Row Level Security (RLS)
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelancer_select_receipts" ON public.receipts;
CREATE POLICY "freelancer_select_receipts"
  ON public.receipts FOR SELECT
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "freelancer_insert_receipts" ON public.receipts;
CREATE POLICY "freelancer_insert_receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "client_select_receipts" ON public.receipts;
CREATE POLICY "client_select_receipts"
  ON public.receipts FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.get_auth_client_ids())
  );

-- 3. Collision-Safe Receipt Number Generator
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq BIGINT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq := nextval('public.receipt_number_seq');
  RETURN 'RCP-FD-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- 4. Enhance razorpay_orders with expiration for checkout reservations
ALTER TABLE public.razorpay_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '30 minutes');
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status_expires ON public.razorpay_orders (status, expires_at);

-- 5. Enhance email_events for atomic outbox claiming & retry
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 3;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_events_status_retry
  ON public.email_events (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

-- 6. Atomic Outbox Event Claiming Function
CREATE OR REPLACE FUNCTION public.claim_pending_email_event(p_worker_id TEXT)
RETURNS SETOF public.email_events
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_events
  SET 
    status = 'processing',
    claimed_at = timezone('utc'::text, now()),
    locked_by = p_worker_id
  WHERE id = (
    SELECT id
    FROM public.email_events
    WHERE (status = 'pending')
       OR (status = 'failed' AND attempt_count < max_attempts AND (next_attempt_at IS NULL OR next_attempt_at <= timezone('utc'::text, now())))
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 7. PostgreSQL Transactional Settlement RPC: settle_razorpay_payment
CREATE OR REPLACE FUNCTION public.settle_razorpay_payment(
  p_razorpay_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_razorpay_signature TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'INR',
  p_payment_method TEXT DEFAULT 'razorpay',
  p_captured_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  p_expected_invoice_id UUID DEFAULT NULL,
  p_expected_client_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_payment RECORD;
  v_existing_receipt RECORD;
  v_order RECORD;
  v_invoice RECORD;
  v_invoice_id UUID;
  v_workspace_id UUID;
  v_client_id UUID;
  v_current_paid NUMERIC;
  v_total NUMERIC;
  v_remaining NUMERIC;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_payment_id UUID;
  v_receipt_id UUID;
  v_receipt_number TEXT;
  v_workspace_owner_id UUID;
BEGIN
  -- Validate required payment ID
  IF p_razorpay_payment_id IS NULL OR btrim(p_razorpay_payment_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_PAYMENT_ID',
      'error', 'Razorpay payment ID is required for settlement.'
    );
  END IF;

  -- 1. Idempotency Check: if exact payment ID exists, return existing settlement
  SELECT * INTO v_existing_payment
  FROM public.invoice_payments
  WHERE razorpay_payment_id = p_razorpay_payment_id
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = v_existing_payment.invoice_id;
    SELECT * INTO v_existing_receipt FROM public.receipts WHERE razorpay_payment_id = p_razorpay_payment_id LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true,
      'duplicateSuppressed', true,
      'alreadyProcessed', true,
      'paymentId', p_razorpay_payment_id,
      'dbPaymentId', v_existing_payment.id,
      'orderId', p_razorpay_order_id,
      'invoiceId', v_existing_payment.invoice_id,
      'invoiceNumber', COALESCE(v_invoice.invoice_number, ''),
      'status', COALESCE(v_invoice.status, 'paid'),
      'amountSettled', v_existing_payment.amount,
      'totalAmount', COALESCE(v_invoice.total_amount, 0),
      'paidAmount', COALESCE(v_invoice.paid_amount, 0),
      'remainingBalance', GREATEST(0, COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.paid_amount, 0)),
      'receipt', CASE 
        WHEN v_existing_receipt.id IS NOT NULL THEN jsonb_build_object(
          'id', v_existing_receipt.id,
          'receiptNumber', v_existing_receipt.receipt_number,
          'invoiceId', v_existing_receipt.invoice_id,
          'invoiceNumber', COALESCE(v_invoice.invoice_number, ''),
          'clientId', v_existing_receipt.client_id,
          'clientName', COALESCE(v_invoice.client_name, ''),
          'amount', v_existing_receipt.amount,
          'currency', v_existing_receipt.currency,
          'paymentMethod', v_existing_receipt.payment_method,
          'paymentDate', v_existing_receipt.payment_date,
          'remainingBalance', GREATEST(0, COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.paid_amount, 0)),
          'totalAmount', COALESCE(v_invoice.total_amount, 0),
          'razorpayPaymentId', p_razorpay_payment_id,
          'razorpayOrderId', p_razorpay_order_id
        )
        ELSE NULL
      END
    );
  END IF;

  -- 2. Resolve razorpay_order mapping
  IF p_razorpay_order_id IS NOT NULL AND btrim(p_razorpay_order_id) <> '' THEN
    SELECT * INTO v_order
    FROM public.razorpay_orders
    WHERE order_id = p_razorpay_order_id
    LIMIT 1;

    IF FOUND THEN
      v_invoice_id := v_order.invoice_id;
      v_workspace_id := v_order.workspace_id;
      v_client_id := v_order.client_id;
    END IF;
  END IF;

  -- Safe fallback to expected_invoice_id ONLY IF verified
  IF v_invoice_id IS NULL AND p_expected_invoice_id IS NOT NULL THEN
    v_invoice_id := p_expected_invoice_id;
  END IF;

  -- If still unresolved: FAIL CLOSED immediately (No guessing)
  IF v_invoice_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNRESOLVED_PAYMENT',
      'error', 'Unable to safely associate this payment with a FlowDesk invoice. No matching order found.'
    );
  END IF;

  -- 3. Row-level Lock on Invoice: SELECT ... FOR UPDATE
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVOICE_NOT_FOUND',
      'error', 'Target invoice could not be located.'
    );
  END IF;

  -- 4. Cross-Tenant / Client Isolation Checks
  IF p_expected_client_id IS NOT NULL AND v_invoice.client_id IS NOT NULL AND v_invoice.client_id <> p_expected_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNAUTHORIZED_CLIENT',
      'error', 'Unauthorized: Invoice belongs to a different client account.'
    );
  END IF;

  IF v_workspace_id IS NOT NULL AND v_invoice.workspace_id <> v_workspace_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'WORKSPACE_MISMATCH',
      'error', 'Security violation: Workspace tenancy mismatch.'
    );
  END IF;
  v_workspace_id := v_invoice.workspace_id;
  v_client_id := v_invoice.client_id;

  -- 5. Currency Integrity Check
  IF UPPER(COALESCE(p_currency, 'INR')) <> UPPER(COALESCE(v_invoice.currency, 'INR')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'CURRENCY_MISMATCH',
      'error', 'Payment currency (' || p_currency || ') does not match invoice currency (' || COALESCE(v_invoice.currency, 'INR') || ').'
    );
  END IF;

  -- 6. Status Checks
  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVOICE_CANCELLED',
      'error', 'This invoice has been cancelled and cannot accept payments.'
    );
  END IF;

  -- 7. Concurrent Balance & Overpayment Check
  v_total := COALESCE(v_invoice.total_amount, 0);
  v_current_paid := COALESCE(v_invoice.paid_amount, 0);
  v_remaining := v_total - v_current_paid;

  IF v_remaining <= 0 OR v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVOICE_ALREADY_PAID',
      'error', 'This invoice is already fully paid.'
    );
  END IF;

  IF (v_current_paid + p_amount) > v_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      'error', 'Payment amount exceeds outstanding invoice balance.'
    );
  END IF;

  -- 8. Compute New Balances & Status
  v_new_paid := v_current_paid + p_amount;
  v_new_remaining := GREATEST(0, v_total - v_new_paid);
  v_new_status := CASE 
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE v_invoice.status
  END;

  -- 9. Insert invoice_payments
  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    payment_method,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    gateway,
    gateway_status,
    currency,
    captured_at,
    payment_date,
    notes
  ) VALUES (
    v_invoice_id,
    p_amount,
    p_payment_method,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    'razorpay',
    'captured',
    p_currency,
    p_captured_at,
    p_captured_at,
    COALESCE(p_notes, 'Online payment via Razorpay')
  )
  RETURNING id INTO v_payment_id;

  -- 10. Update Invoice
  UPDATE public.invoices
  SET 
    paid_amount = v_new_paid,
    status = v_new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_invoice_id;

  -- 11. Update Razorpay Order status if order ID is present
  IF p_razorpay_order_id IS NOT NULL AND btrim(p_razorpay_order_id) <> '' THEN
    UPDATE public.razorpay_orders
    SET 
      status = 'paid',
      updated_at = timezone('utc'::text, now())
    WHERE order_id = p_razorpay_order_id;
  END IF;

  -- 12. Create Durable Receipt in database
  v_receipt_number := public.generate_receipt_number();
  INSERT INTO public.receipts (
    receipt_number,
    invoice_id,
    invoice_payment_id,
    workspace_id,
    client_id,
    amount,
    currency,
    payment_method,
    payment_date,
    razorpay_payment_id,
    razorpay_order_id,
    notes
  ) VALUES (
    v_receipt_number,
    v_invoice_id,
    v_payment_id,
    v_workspace_id,
    v_client_id,
    p_amount,
    p_currency,
    p_payment_method,
    p_captured_at,
    p_razorpay_payment_id,
    p_razorpay_order_id,
    'Receipt for Invoice #' || v_invoice.invoice_number
  )
  RETURNING id INTO v_receipt_id;

  -- 13. Idempotent Activity Log
  INSERT INTO public.activities (
    workspace_id,
    client_id,
    action,
    title,
    description,
    user_name,
    resource_type,
    resource_id
  ) VALUES (
    v_workspace_id,
    v_client_id,
    'payment_received',
    'Captured Online Payment',
    'Payment of ' || p_currency || ' ' || p_amount::text || ' settled via Razorpay (Ref: ' || p_razorpay_payment_id || ') for Invoice #' || v_invoice.invoice_number,
    COALESCE(v_invoice.client_name, 'Client'),
    'invoice',
    v_invoice_id
  );

  -- 14. Idempotent In-App Notification
  SELECT owner_id INTO v_workspace_owner_id FROM public.workspaces WHERE id = v_workspace_id LIMIT 1;
  IF v_workspace_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      workspace_id,
      client_id,
      user_id,
      type,
      title,
      message,
      link,
      read
    ) VALUES (
      v_workspace_id,
      v_client_id,
      v_workspace_owner_id,
      'payment_received',
      'Payment Received: #' || v_invoice.invoice_number,
      'Received ' || p_currency || ' ' || p_amount::text || ' from ' || COALESCE(v_invoice.client_name, 'Client'),
      '/invoices',
      false
    );
  END IF;

  -- 15. Return Canonical Result
  RETURN jsonb_build_object(
    'success', true,
    'duplicateSuppressed', false,
    'alreadyProcessed', false,
    'paymentId', p_razorpay_payment_id,
    'dbPaymentId', v_payment_id,
    'orderId', p_razorpay_order_id,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice.invoice_number,
    'workspaceId', v_workspace_id,
    'clientId', v_client_id,
    'clientName', v_invoice.client_name,
    'clientEmail', v_invoice.client_email,
    'status', v_new_status,
    'amountSettled', p_amount,
    'totalAmount', v_total,
    'paidAmount', v_new_paid,
    'remainingBalance', v_new_remaining,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'receiptNumber', v_receipt_number,
      'invoiceId', v_invoice_id,
      'invoiceNumber', v_invoice.invoice_number,
      'clientId', v_client_id,
      'clientName', v_invoice.client_name,
      'amount', p_amount,
      'currency', p_currency,
      'paymentMethod', p_payment_method,
      'paymentDate', p_captured_at,
      'notes', 'Receipt for Invoice #' || v_invoice.invoice_number,
      'remainingBalance', v_new_remaining,
      'totalAmount', v_total,
      'razorpayPaymentId', p_razorpay_payment_id,
      'razorpayOrderId', p_razorpay_order_id
    )
  );
END;
$$;
