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

