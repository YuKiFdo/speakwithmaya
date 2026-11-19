-- 026: Move learners stuck on an ended campaign Pro Pass back to Starter.
--
-- Bug (fixed in subscription-reconciliation.service.ts): the nightly quota reset treated an ended
-- 'trialing' Pro Pass as a monthly paid plan, so the learner stayed plan_tier='pro' / 'trialing' with
-- 5 minutes and a reset date pushed ~30 days out. The trial really ended at
-- last_comeback_at + campaign starter_trial_days (default 3).
--
-- Run STEP 1, review, then STEP 2.

-- ── STEP 1: preview ─────────────────────────────────────────────────────────────
SELECT p.id,
       p.display_name,
       p.active_promo_code,
       p.last_comeback_at,
       COALESCE(c.starter_trial_days, c.trial_days, 3)                         AS trial_days,
       p.last_comeback_at + make_interval(days => COALESCE(c.starter_trial_days, c.trial_days, 3)) AS trial_ended_at,
       p.minutes_balance,
       p.minutes_reset_at
FROM public.profiles p
LEFT JOIN public.promotion_campaigns c ON c.id = p.active_promo_code
WHERE p.plan_status = 'trialing'
  AND p.last_comeback_at IS NOT NULL
  AND p.last_comeback_at + make_interval(days => COALESCE(c.starter_trial_days, c.trial_days, 3)) < now()
ORDER BY p.last_comeback_at;

-- ── STEP 2: apply ───────────────────────────────────────────────────────────────
BEGIN;

UPDATE public.profiles p
SET plan_tier                 = 'starter',
    plan_status               = 'expired',
    billing_cycle             = 'daily',
    monthly_minutes_allowance = 5,
    minutes_balance           = 5 + COALESCE(p.add_on_minutes_balance, 0),
    minutes_reset_at          = now() + interval '1 day',
    updated_at                = now()
FROM public.profiles p2
LEFT JOIN public.promotion_campaigns c ON c.id = p2.active_promo_code
WHERE p.id = p2.id
  AND p.plan_status = 'trialing'
  AND p.last_comeback_at IS NOT NULL
  AND p.last_comeback_at + make_interval(days => COALESCE(c.starter_trial_days, c.trial_days, 3)) < now();

-- Check the row count, then COMMIT (or ROLLBACK).
COMMIT;
