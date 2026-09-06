-- ============================================================
-- Phase 24: Transactional Email Events & Preferences
-- Idempotency tracking, delivery audit, and notification settings
-- ============================================================

-- 1. Create email_events table
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  provider TEXT DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT DEFAULT 'pending', -- pending | sent | delivered | failed | bounced
  attempt_count INT DEFAULT 1,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE
);

-- 2. Idempotency unique index for reference-bound event types
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_idempotency
  ON public.email_events (event_type, reference_id, recipient)
  WHERE reference_id IS NOT NULL;

-- 3. Add email preference columns to workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'email_client_invitations'
  ) THEN
    ALTER TABLE public.workspaces
      ADD COLUMN email_client_invitations BOOLEAN DEFAULT TRUE,
      ADD COLUMN email_deliverable_actions BOOLEAN DEFAULT TRUE,
      ADD COLUMN email_revision_requests BOOLEAN DEFAULT TRUE,
      ADD COLUMN email_document_updates BOOLEAN DEFAULT TRUE,
      ADD COLUMN email_invoice_events BOOLEAN DEFAULT TRUE,
      ADD COLUMN email_payment_events BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- 4. RLS for email_events
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Freelancers can view own workspace email events" ON public.email_events;
CREATE POLICY "Freelancers can view own workspace email events" ON public.email_events
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );
