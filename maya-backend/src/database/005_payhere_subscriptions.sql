-- 005_payhere_subscriptions.sql
-- Migration: PayHere Recurring Billing, Subscriptions, and Payment Telemetry

-- 1. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payhere_subscription_id TEXT UNIQUE,
  customer_token TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('starter', 'basic', 'pro', 'premium')) NOT NULL,
  billing_cycle TEXT NOT NULL, -- e.g. '1 Month', '3 Month', '1 Year'
  amount_lkr NUMERIC(10, 2) NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'COMPLETED')) DEFAULT 'PENDING',
  next_billing_date DATE,
  installments_paid INTEGER DEFAULT 0,
  card_holder_name TEXT,
  card_masked TEXT,
  card_expiry TEXT,
  payment_method TEXT,
  last_payment_id TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by user and status
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payhere_id ON public.subscriptions(payhere_subscription_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own subscription
CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Enhance Orders Table for PayHere Telemetry
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payhere_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payhere_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS md5sig TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_payhere_sub ON public.orders(payhere_subscription_id);
