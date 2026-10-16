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

  IF v_inv.status = 'claimed' THEN
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
     SET user_id = p_user_id, updated_at = now()
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
