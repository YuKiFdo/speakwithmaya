-- 004_auth_otp_and_plans_catalog.sql
-- Migration: Phone OTP Verification, Multi-Tier Plans Catalog, and Usage Quotas

-- 1. Phone OTP Verification & Rate-Limiting Table
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone 
  ON public.phone_verifications(phone_number, created_at DESC);

-- Enable RLS for phone_verifications (backend service role only)
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- 2. Enhance Profiles Table with Multi-Tier Plans & Quotas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier TEXT CHECK (plan_tier IN ('starter', 'basic', 'pro', 'premium')) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_status TEXT CHECK (plan_status IN ('active', 'trialing', 'past_due', 'canceled')) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS monthly_minutes_allowance INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS add_on_minutes_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  ADD COLUMN IF NOT EXISTS native_language TEXT DEFAULT 'sinhala',
  ADD COLUMN IF NOT EXISTS employment_status TEXT,
  ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS baseline_fluency_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_grammar_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_pronunciation_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_step TEXT DEFAULT '/onboarding/personalized-plan',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Ensure starter plan initial minutes balance defaults to 10
ALTER TABLE public.profiles 
  ALTER COLUMN minutes_balance SET DEFAULT 10;

-- 3. Invoices / Order Transactions (Payment Gateway Ready)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_type TEXT CHECK (order_type IN ('subscription_new', 'subscription_renewal', 'add_on_topup')) NOT NULL,
  plan_tier TEXT,
  add_on_package_id TEXT,
  amount_lkr NUMERIC(10, 2) NOT NULL,
  minutes_credited INTEGER NOT NULL,
  payment_gateway TEXT DEFAULT 'mock',
  gateway_payment_id TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);
