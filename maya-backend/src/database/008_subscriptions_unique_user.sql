-- Migration: 008_subscriptions_unique_user.sql
-- Description: Enforce that each user can have at most ONE active subscription at any time.
-- Superseded, canceled, or expired subscriptions remain in the table for billing audit history.

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_user_unique
ON public.subscriptions (user_id)
WHERE status = 'ACTIVE';

COMMENT ON INDEX idx_subscriptions_active_user_unique IS
'Guarantees at database-level that a user can have at most one ACTIVE subscription row.';
