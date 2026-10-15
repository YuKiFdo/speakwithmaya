-- 006_payhere_customer_token.sql
-- Migration: Add customer_token to subscriptions for PayHere Automated Charging (Pre-approved Tokenization)

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS customer_token TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_token 
  ON public.subscriptions(customer_token);
