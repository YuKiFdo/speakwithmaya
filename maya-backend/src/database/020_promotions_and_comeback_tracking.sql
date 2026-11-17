-- ==============================================================================
-- Migration 020: Promotions & Comeback Tracking
-- Tracks post-outage student comebacks, 3-Day Pro Passes, and 100 Bonus Minutes claims.
-- Architecture is fully extensible for all future marketing and holiday promotions.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.promotion_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_code TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  reward_type TEXT NOT NULL, -- 'pro_pass' | 'bonus_minutes' | 'discount_pass'
  reward_value NUMERIC NOT NULL, -- e.g. 120 (mins) or 100 (bonus mins)
  original_tier TEXT NOT NULL, -- 'starter' | 'basic' | 'pro' | 'premium'
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- e.g. claimed_at + 3 days for Pro Pass
  status TEXT DEFAULT 'active', -- 'active' | 'used' | 'expired'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_claims_user_id ON public.promotion_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_claims_promo_code ON public.promotion_claims(promo_code);
CREATE INDEX IF NOT EXISTS idx_promotion_claims_claimed_at ON public.promotion_claims(claimed_at DESC);

-- Track last comeback time on student profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_comeback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_promo_code TEXT;

-- Campaign Management (extensible for all future comeback & marketing promotions)
CREATE TABLE IF NOT EXISTS public.promotion_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- 'active' | 'scheduled' | 'ended' | 'draft'
  reward_type TEXT NOT NULL, -- 'pro_pass' | 'bonus_minutes' | 'discount_pass'
  reward_value NUMERIC NOT NULL,
  trial_days INTEGER DEFAULT 3,
  target_audience TEXT DEFAULT 'all', -- 'all' | 'old_only' | 'new_only'
  target_tiers JSONB DEFAULT '["starter", "basic", "pro", "premium"]'::jsonb,
  user_created_before TIMESTAMPTZ,
  user_created_after TIMESTAMPTZ,
  valid_days INTEGER DEFAULT 7,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  max_claims INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed outage recovery campaign
INSERT INTO public.promotion_campaigns (
  id,
  title,
  description,
  status,
  reward_type,
  reward_value,
  trial_days,
  target_audience,
  target_tiers,
  user_created_before,
  valid_days,
  start_date,
  end_date
) VALUES (
  'outage-comeback-nov26',
  'Global Infrastructure Outage Recovery & Apology Campaign',
  'Apology compensation for 3-day global infrastructure outage. Starter users get 3-Day Pro Pass (120 mins); Paid subscribers receive 100 non-expiring bonus minutes.',
  'active',
  'pro_pass',
  120,
  3,
  'old_only',
  '["starter", "basic", "pro", "premium"]'::jsonb,
  NOW(),
  7,
  NOW(),
  NOW() + INTERVAL '7 days'
) ON CONFLICT (id) DO NOTHING;


