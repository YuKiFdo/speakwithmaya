-- ==============================================================================
-- Maya AI Migration 012: Allow 'daily' billing cycle in profiles table
-- Supports Starter Plan daily quota and Telco (IdeaMart / mSpace) daily billing
-- Run this in Supabase Dashboard -> SQL Editor (sjhvhjxbkpidrjbpiqfw)
-- ==============================================================================

-- 1. Drop existing constraint if present
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_cycle_check;

-- 2. Add updated constraint supporting 'daily', 'monthly', 'quarterly', and 'yearly'
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_cycle_check
  CHECK (billing_cycle IN ('daily', 'monthly', 'quarterly', 'yearly'));

-- 3. Optionally update existing starter profiles to 'daily'
UPDATE public.profiles
SET billing_cycle = 'daily'
WHERE plan_tier = 'starter' AND (billing_cycle IS NULL OR billing_cycle = 'monthly');
