-- =====================================================================
-- FLOWDESK: 30-DAY STANDARD LAUNCH PROMOTION & TRIAL LIFECYCLE SCHEMA
-- =====================================================================

-- 1. Add promotion and trial lifecycle columns to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotion_type TEXT DEFAULT 'launch_standard_30d',
  ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_claimed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS announcement_seen BOOLEAN DEFAULT false;

-- 2. Index for quick trial status and expiry lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_status
  ON public.subscriptions(trial_status, trial_end);

-- 3. Notification tracking column for trial reminders to prevent duplicates
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_reminders_sent JSONB DEFAULT '[]'::jsonb;

-- 4. Apply 30-Day Free Standard Launch Promotion to all existing workspaces
-- that do not have an active paid Razorpay subscription
UPDATE public.subscriptions
SET
  plan_key = 'standard',
  status = 'trialing',
  trial_start = COALESCE(trial_start, NOW()),
  trial_end = COALESCE(trial_end, NOW() + INTERVAL '30 days'),
  current_period_start = COALESCE(current_period_start, NOW()),
  current_period_end = COALESCE(current_period_end, NOW() + INTERVAL '30 days'),
  promotion_type = 'launch_standard_30d',
  trial_status = 'active',
  trial_claimed = true,
  announcement_seen = false,
  provider = 'launch_standard_30d'
WHERE
  (razorpay_subscription_id IS NULL OR razorpay_subscription_id = '')
  AND (status = 'active' OR status = 'trialing' OR plan_key = 'starter' OR trial_claimed IS NOT TRUE);

-- 5. Ensure any workspace without a subscriptions record gets provisioned
INSERT INTO public.subscriptions (
  workspace_id,
  plan_key,
  status,
  current_period_start,
  current_period_end,
  trial_start,
  trial_end,
  promotion_type,
  trial_status,
  trial_claimed,
  announcement_seen,
  provider
)
SELECT
  w.id,
  'standard',
  'trialing',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW() + INTERVAL '30 days',
  'launch_standard_30d',
  'active',
  true,
  false,
  'launch_standard_30d'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = w.id
)
ON CONFLICT (workspace_id) DO NOTHING;
