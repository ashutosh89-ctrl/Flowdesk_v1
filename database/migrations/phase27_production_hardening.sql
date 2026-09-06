-- ============================================================
-- Phase 27: Production Hardening — Settlement Security & Schema Consistency
--
-- Resolves (as identified in the beta release-gate audit):
-- 1. settle_razorpay_payment: PUBLIC execution + missing caller authorization
-- 2. settle_razorpay_payment: references non-existent notifications.type column
-- 3. deliverable_comments: client SELECT policy leaks is_internal comments
-- 4. get_auth_client_ids(): cross-workspace client identity via email match
-- 5. user_settings: missing email preference columns referenced by the service layer
-- 6. Invoice number uniqueness: ensure the workspace-scoped unique constraint exists
-- 7. Storage upload policies: path-index mismatch (foldername[1] vs [2])
-- 8. New record_manual_payment RPC: atomic, durable manual settlements with receipts
--
-- This migration is idempotent and safe to run on both fresh and existing databases.
-- ============================================================

-- ============================================================
-- 1. SETTLEMENT RPC: Restrict execution to the server-side service role
-- ============================================================
-- Default Postgres grants EXECUTE to PUBLIC (anon + authenticated). The settlement
-- function must only ever be invoked by the trusted server workflow (service role),
-- never by browser clients.
REVOKE EXECUTE ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_razorpay_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT) TO service_role;

-- ============================================================
-- 2. SETTLEMENT RPC: Recreate with caller enforcement + order-authoritative mapping
-- ============================================================
-- Changes vs phase26:
--   a) Rejects execution unless invoked with the service_role key (defense in depth).
--   b) Invoice mapping is derived ONLY from the stored razorpay_orders record.
--      The p_expected_invoice_id parameter is now a consistency check against the
--      order mapping, never a fallback resolution path (prevents fabricated payments).
--   c) notifications insert uses the real "category" column (schema.sql), not "type".
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
  -- 0. Caller authorization: only the server-side service-role workflow may settle.
  --    auth.role() reads request.jwt.claims, so this holds for SECURITY DEFINER.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: settlement is restricted to the trusted server workflow.';
  END IF;

  -- Validate required payment ID
  IF p_razorpay_payment_id IS NULL OR btrim(p_razorpay_payment_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_PAYMENT_ID',
      'error', 'Razorpay payment ID is required for settlement.'
    );
  END IF;

  -- Validate payment amount: reject NULL, zero, and negative amounts
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_PAYMENT_AMOUNT',
      'error', 'Payment amount must be greater than zero.'
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

  -- 2. Resolve invoice mapping from the AUTHORITATIVE razorpay_orders record.
  --    There is intentionally no fallback to caller-supplied invoice IDs.
  IF p_razorpay_order_id IS NULL OR btrim(p_razorpay_order_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNRESOLVED_PAYMENT',
      'error', 'A Razorpay order ID is required to settle this payment.'
    );
  END IF;

  SELECT * INTO v_order
  FROM public.razorpay_orders
  WHERE order_id = p_razorpay_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNRESOLVED_PAYMENT',
      'error', 'Unable to safely associate this payment with a FlowDesk invoice. No matching order found.'
    );
  END IF;

  v_invoice_id := v_order.invoice_id;
  v_workspace_id := v_order.workspace_id;
  v_client_id := v_order.client_id;

  -- 2b. Consistency checks against caller-provided expectations (defense in depth)
  IF p_expected_invoice_id IS NOT NULL AND p_expected_invoice_id <> v_invoice_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVOICE_MISMATCH',
      'error', 'Security violation: Payment order is not associated with the expected invoice.'
    );
  END IF;

  IF p_expected_client_id IS NOT NULL AND v_client_id IS NOT NULL AND p_expected_client_id <> v_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNAUTHORIZED_CLIENT',
      'error', 'Unauthorized: Order belongs to a different client account.'
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
  UPDATE public.razorpay_orders
  SET
    status = 'paid',
    updated_at = timezone('utc'::text, now())
  WHERE order_id = p_razorpay_order_id;

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

  -- 14. Idempotent In-App Notification (uses real "category" column)
  SELECT owner_id INTO v_workspace_owner_id FROM public.workspaces WHERE id = v_workspace_id LIMIT 1;
  IF v_workspace_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      workspace_id,
      client_id,
      user_id,
      category,
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

-- ============================================================
-- 3. DELIVERABLE COMMENTS: Client SELECT must exclude internal comments
-- ============================================================
DROP POLICY IF EXISTS "client_select_deliverable_comments" ON public.deliverable_comments;

CREATE POLICY "client_select_deliverable_comments"
  ON public.deliverable_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
    AND is_internal = false
  );

-- ============================================================
-- 4. CLIENT IDENTITY: get_auth_client_ids must be user-bound, not email-bound
-- ============================================================
-- Email matching across ALL workspaces granted a person with the same email address
-- access to every freelancer's workspace where that email is a client. Identity is
-- now established by binding the authenticated Supabase user to the client record
-- (clients.user_id) at first login. Email is no longer an identity oracle.
CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid();
$$;

-- Allow a client to bind their own user_id on first login. The update is only
-- permitted when: (a) the record is unbound, (b) the record's email matches the
-- authenticated user's email (from the JWT), and (c) the new user_id is the
-- authenticated user. This makes the first-login email fallback durable without
-- ever letting one user claim a record already bound to another user.
CREATE OR REPLACE FUNCTION public.can_bind_client_identity(record_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND lower(coalesce(record_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Clients can bind own identity'
  ) THEN
    CREATE POLICY "Clients can bind own identity"
    ON public.clients FOR UPDATE TO authenticated
    USING (
      user_id IS NULL
      AND public.can_bind_client_identity(email)
    )
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 5. USER_SETTINGS: add email preference columns referenced by the service layer
-- ============================================================
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_deliverables BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_documents BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_invoices BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_security BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 6. INVOICE NUMBER UNIQUENESS: workspace-scoped constraint (fail loudly)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_workspace_invoice_number'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT unique_workspace_invoice_number;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_workspace_invoice_number_unique'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_workspace_invoice_number_unique;
  END IF;

  ALTER TABLE public.invoices ADD CONSTRAINT unique_workspace_invoice_number UNIQUE (workspace_id, invoice_number);
END $$;

-- ============================================================
-- 7. STORAGE POLICIES: align path indexes with app convention
-- ============================================================
-- Application paths: workspaces/{workspaceId}/{folder}/{filename}
-- storage.foldername() returns the path WITHOUT the filename, e.g.
--   'workspaces/{wsId}/branding/logo.png' -> ['workspaces', '{wsId}', 'branding']
-- so the workspace ID is index [2]. The prior policies used index [1], which
-- resolved to the literal 'workspaces' segment and silently blocked uploads.
DROP POLICY IF EXISTS "Freelancer can upload workspace logos" ON storage.objects;

CREATE POLICY "Freelancer can upload workspace logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

DROP POLICY IF EXISTS "Freelancer can upload signatures" ON storage.objects;

CREATE POLICY "Freelancer can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- Clients may attach revision files to deliverables in the private deliverables bucket
DROP POLICY IF EXISTS "Client can upload own deliverables" ON storage.objects;

CREATE POLICY "Client can upload own deliverables"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- ============================================================
-- 8. MANUAL PAYMENT RPC: atomic, durable, receipt-generating settlements
-- ============================================================
-- Freelancer-recorded offline payments (bank transfer, cash, UPI, cheque, custom)
-- go through this single transactional function so they share the same financial
-- integrity rules as online payments: row locking, overpayment rejection, durable
-- receipts, activity, and notification. Only the workspace owner may execute it.
CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
  v_total NUMERIC;
  v_current_paid NUMERIC;
  v_remaining NUMERIC;
  v_settle_amount NUMERIC;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_payment_id UUID;
  v_receipt_id UUID;
  v_receipt_number TEXT;
  v_workspace_owner_id UUID;
  v_method TEXT;
BEGIN
  -- Authentication: a signed-in user is required
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record a payment.';
  END IF;

  IF p_invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_REQUIRED', 'error', 'Invoice ID is required.');
  END IF;

  -- Row-level lock on the invoice (serializes concurrent settlements)
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_NOT_FOUND', 'error', 'Invoice not found.');
  END IF;

  -- Authorization: only the workspace owner may record offline payments
  IF NOT public.is_workspace_owner(v_invoice.workspace_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'FORBIDDEN',
      'error', 'Only the workspace owner can record payments for this invoice.'
    );
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_CANCELLED', 'error', 'This invoice is cancelled and cannot accept payments.');
  END IF;

  v_total := COALESCE(v_invoice.total_amount, 0);
  v_current_paid := COALESCE(v_invoice.paid_amount, 0);
  v_remaining := v_total - v_current_paid;

  IF v_remaining <= 0 OR v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVOICE_ALREADY_PAID', 'error', 'This invoice is already fully paid.');
  END IF;

  -- Amount: null/absent settles the full remaining balance; otherwise validate strictly
  IF p_amount IS NULL THEN
    v_settle_amount := v_remaining;
  ELSE
    IF p_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_AMOUNT', 'error', 'Payment amount must be greater than zero.');
    END IF;
    IF p_amount > v_remaining THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
        'error', 'Payment amount exceeds the outstanding invoice balance.'
      );
    END IF;
    v_settle_amount := p_amount;
  END IF;

  v_new_paid := v_current_paid + v_settle_amount;
  v_new_remaining := GREATEST(0, v_total - v_new_paid);
  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE v_invoice.status
  END;

  v_method := COALESCE(NULLIF(btrim(p_payment_method), ''), 'bank_transfer');

  -- Durable payment record (no fabricated Razorpay identifiers)
  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    payment_method,
    gateway,
    gateway_status,
    currency,
    payment_date,
    notes
  ) VALUES (
    v_invoice.id,
    v_settle_amount,
    v_method,
    'manual',
    'completed',
    COALESCE(v_invoice.currency, 'USD'),
    timezone('utc'::text, now()),
    COALESCE(NULLIF(btrim(p_notes), ''), 'Offline settlement recorded')
  )
  RETURNING id INTO v_payment_id;

  -- Update invoice balance + payment status
  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    status = v_new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_invoice.id;

  -- Durable receipt
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
    notes
  ) VALUES (
    v_receipt_number,
    v_invoice.id,
    v_payment_id,
    v_invoice.workspace_id,
    v_invoice.client_id,
    v_settle_amount,
    COALESCE(v_invoice.currency, 'USD'),
    v_method,
    timezone('utc'::text, now()),
    'Receipt for Invoice #' || v_invoice.invoice_number
  )
  RETURNING id INTO v_receipt_id;

  -- Activity
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
    v_invoice.workspace_id,
    v_invoice.client_id,
    'payment_received',
    'Recorded Offline Payment',
    'Payment of ' || COALESCE(v_invoice.currency, 'USD') || ' ' || v_settle_amount::text || ' recorded via ' || v_method || ' for Invoice #' || v_invoice.invoice_number,
    COALESCE(v_invoice.client_name, 'Client'),
    'invoice',
    v_invoice.id
  );

  -- In-app notification for the freelancer
  SELECT owner_id INTO v_workspace_owner_id FROM public.workspaces WHERE id = v_invoice.workspace_id LIMIT 1;
  IF v_workspace_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      workspace_id,
      client_id,
      user_id,
      category,
      title,
      message,
      link,
      read
    ) VALUES (
      v_invoice.workspace_id,
      v_invoice.client_id,
      v_workspace_owner_id,
      'payment_received',
      'Payment Received: #' || v_invoice.invoice_number,
      'Recorded ' || COALESCE(v_invoice.currency, 'USD') || ' ' || v_settle_amount::text || ' via ' || v_method || ' for Invoice #' || v_invoice.invoice_number,
      '/invoices',
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'paymentId', v_payment_id,
    'invoiceId', v_invoice.id,
    'invoiceNumber', v_invoice.invoice_number,
    'workspaceId', v_invoice.workspace_id,
    'clientId', v_invoice.client_id,
    'clientName', v_invoice.client_name,
    'clientEmail', v_invoice.client_email,
    'status', v_new_status,
    'amountSettled', v_settle_amount,
    'totalAmount', v_total,
    'paidAmount', v_new_paid,
    'remainingBalance', v_new_remaining,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'receiptNumber', v_receipt_number,
      'invoiceId', v_invoice.id,
      'invoiceNumber', v_invoice.invoice_number,
      'clientId', v_invoice.client_id,
      'clientName', v_invoice.client_name,
      'amount', v_settle_amount,
      'currency', COALESCE(v_invoice.currency, 'USD'),
      'paymentMethod', v_method,
      'paymentDate', timezone('utc'::text, now()),
      'remainingBalance', v_new_remaining,
      'totalAmount', v_total
    )
  );
END;
$$;

-- Manual payment RPC: authenticated workspace owners only (anon never)
REVOKE EXECUTE ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(UUID, NUMERIC, TEXT, TEXT) TO service_role;