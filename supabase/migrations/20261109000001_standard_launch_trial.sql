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

