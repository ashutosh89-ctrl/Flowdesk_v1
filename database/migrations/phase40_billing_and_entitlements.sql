-- ==============================================================================
-- PHASE 40: FLOWDESK SAAS BILLING & ENTITLEMENTS SCHEMA
-- ==============================================================================
-- Description:
--   Implements tables, constraints, indexes, RLS policies, helper functions,
--   and backfill for FlowDesk platform subscriptions and quota entitlements.
--
-- Tables created:
--   1. public.plans
--   2. public.subscriptions
--   3. public.billing_events
--   4. public.usage_counters
--   5. public.entitlement_overrides
--
-- Safety & Boundaries:
--   - Read-only for authenticated workspace owners on their own data.
--   - Zero client-side INSERT/UPDATE/DELETE. Server writes only via admin client.
--   - Client portal users (clients table) have NO access to any billing table.
--   - Idempotent backfill: all existing workspaces start on the 'free' plan.
-- ==============================================================================

-- 1. PLANS TABLE (Mirror of plans.config.ts for referential integrity & reporting)
CREATE TABLE IF NOT EXISTS public.plans (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed static plan keys (Idempotent)
INSERT INTO public.plans (key, name, active)
VALUES 
  ('free', 'Free Starter', true),
  ('pro', 'Pro Freelancer', true),
  ('studio', 'Studio Agency', true)
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  active = EXCLUDED.active;

-- 2. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL REFERENCES public.plans(key),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN (
    'trialing',
    'active',
    'past_due',
    'grace',
    'canceled_at_period_end',
    'canceled',
    'expired'
  )),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: Only one active subscription record per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_workspace_active 
  ON public.subscriptions(workspace_id) 
  WHERE status NOT IN ('canceled', 'expired');

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id 
  ON public.subscriptions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub_id 
  ON public.subscriptions(provider_subscription_id) 
  WHERE provider_subscription_id IS NOT NULL;

-- 3. BILLING EVENTS TABLE (Webhook deduplication & audit trail)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_events_workspace_id 
  ON public.billing_events(workspace_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_provider_event_id 
  ON public.billing_events(provider_event_id);

-- 4. USAGE COUNTERS TABLE (Quota tracking per billing cycle)
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period_start DATE NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_metric_period UNIQUE (workspace_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_workspace_id 
  ON public.usage_counters(workspace_id);

-- 5. ENTITLEMENT OVERRIDES TABLE (Support grants / custom enterprise allowances)
CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  value JSONB NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_workspace_id 
  ON public.entitlement_overrides(workspace_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- Plans: Read-only for all authenticated users
DROP POLICY IF EXISTS "plans_read_all" ON public.plans;
CREATE POLICY "plans_read_all" ON public.plans
  FOR SELECT TO authenticated
  USING (true);

-- Subscriptions: Read-only for workspace owner
DROP POLICY IF EXISTS "subscriptions_owner_read" ON public.subscriptions;
CREATE POLICY "subscriptions_owner_read" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = subscriptions.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Billing Events: Read-only for workspace owner
DROP POLICY IF EXISTS "billing_events_owner_read" ON public.billing_events;
CREATE POLICY "billing_events_owner_read" ON public.billing_events
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = billing_events.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Usage Counters: Read-only for workspace owner
DROP POLICY IF EXISTS "usage_counters_owner_read" ON public.usage_counters;
CREATE POLICY "usage_counters_owner_read" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = usage_counters.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Entitlement Overrides: Read-only for workspace owner
DROP POLICY IF EXISTS "entitlement_overrides_owner_read" ON public.entitlement_overrides;
CREATE POLICY "entitlement_overrides_owner_read" ON public.entitlement_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = entitlement_overrides.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- STRICT WRITE DENIAL: No INSERT/UPDATE/DELETE policies are created for 'authenticated'
-- or 'anon' roles on billing tables. All mutations MUST execute via the server-side
-- admin/service-role client from authenticated routes or webhook processors.

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

-- Function: get_workspace_plan(workspace_id)
-- Resolves the current plan key and status for a given workspace.
-- Executes with SECURITY INVOKER and a fixed search_path.
CREATE OR REPLACE FUNCTION public.get_workspace_plan(p_workspace_id UUID)
RETURNS TABLE (
  plan_key TEXT,
  status TEXT,
  is_active BOOLEAN,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT 
    COALESCE(s.plan_key, 'free') AS plan_key,
    COALESCE(s.status, 'active') AS status,
    (s.status IS NULL OR s.status IN ('trialing', 'active', 'canceled_at_period_end')) AS is_active,
    s.current_period_end,
    COALESCE(s.cancel_at_period_end, false) AS cancel_at_period_end
  FROM public.workspaces w
  LEFT JOIN public.subscriptions s 
    ON s.workspace_id = w.id 
    AND s.status NOT IN ('canceled', 'expired')
  WHERE w.id = p_workspace_id
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- ==============================================================================
-- IDEMPOTENT BACKFILL
-- ==============================================================================
-- Every existing workspace that does not already have a subscription is assigned
-- the Free Starter plan with active status.
INSERT INTO public.subscriptions (
  workspace_id,
  plan_key,
  billing_interval,
  status,
  provider,
  cancel_at_period_end,
  created_at,
  updated_at
)
SELECT 
  w.id,
  'free',
  'monthly',
  'active',
  'razorpay',
  false,
  now(),
  now()
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.workspace_id = w.id
)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- DATABASE LEVEL QUOTA ENFORCEMENT TRIGGERS (DEFENSE-IN-DEPTH)
-- ==============================================================================
-- Blocks direct client-side insertion beyond plan quota limits for projects
-- and clients even if a legacy browser-side path is executed.

CREATE OR REPLACE FUNCTION public.check_project_quota_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_key TEXT;
  v_status TEXT;
  v_limit INT := 3; -- Free default
  v_current_count INT;
BEGIN
  SELECT COALESCE(s.plan_key, 'free'), COALESCE(s.status, 'active')
  INTO v_plan_key, v_status
  FROM public.workspaces w
  LEFT JOIN public.subscriptions s 
    ON s.workspace_id = w.id 
    AND s.status NOT IN ('canceled', 'expired')
  WHERE w.id = NEW.workspace_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_status = 'grace' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PAST_DUE: Workspace is in grace period. Creation write-locked.' 
      USING ERRCODE = 'P0001';
  END IF;

  IF v_plan_key = 'studio' THEN
    v_limit := 150;
  ELSIF v_plan_key = 'pro' THEN
    v_limit := 25;
  ELSE
    v_limit := 3;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.projects
  WHERE workspace_id = NEW.workspace_id
    AND status != 'archived';

  IF v_current_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED: Workspace has reached maximum active projects limit (%) for plan %', v_limit, v_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_project_quota ON public.projects;
CREATE TRIGGER trg_check_project_quota
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_project_quota_before_insert();

CREATE OR REPLACE FUNCTION public.check_client_quota_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_key TEXT;
  v_status TEXT;
  v_limit INT := 2; -- Free default
  v_current_count INT;
BEGIN
  SELECT COALESCE(s.plan_key, 'free'), COALESCE(s.status, 'active')
  INTO v_plan_key, v_status
  FROM public.workspaces w
  LEFT JOIN public.subscriptions s 
    ON s.workspace_id = w.id 
    AND s.status NOT IN ('canceled', 'expired')
  WHERE w.id = NEW.workspace_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_status = 'grace' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PAST_DUE: Workspace is in grace period. Creation write-locked.' 
      USING ERRCODE = 'P0001';
  END IF;

  IF v_plan_key = 'studio' THEN
    v_limit := 100;
  ELSIF v_plan_key = 'pro' THEN
    v_limit := 15;
  ELSE
    v_limit := 2;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.clients
  WHERE workspace_id = NEW.workspace_id
    AND status != 'pending_deletion';

  IF v_current_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED: Workspace has reached maximum active clients limit (%) for plan %', v_limit, v_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_client_quota ON public.clients;
CREATE TRIGGER trg_check_client_quota
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.check_client_quota_before_insert();

