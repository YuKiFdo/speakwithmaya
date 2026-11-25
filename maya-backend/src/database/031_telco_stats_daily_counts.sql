-- 031: Server-side daily counts for the IDEACIPHER telco stats endpoint (GET /stats/summary).
--
-- Why: StatsService downloaded every profile, every telco verification and every subscription
-- (thousands of rows, and growing) just to count subscribers per day. PostgREST also caps an
-- unpaged response at 1000 rows, which silently undercounted the dashboard. This function
-- applies the same rules in Postgres and returns one small JSON object:
--   { "2026-11-24": 41, "2026-11-25": 77, ... }   (Asia/Colombo calendar days)
-- One key per day with signups, so it stays a few KB regardless of user count.
--
-- Rules (must match StatsService.getTelcoDailyCountsFallback):
--   * skip test accounts: phone digits in test_digits, or monthly_minutes_allowance >= 9000
--   * telco subscriber if: telco_subscriber_id / telco_provider set, or a verified
--     'TELCO:%' phone_verifications row exists for the phone; or (implicit) the telco SMS
--     gateway is active and the profile is daily/starter with no card subscription
--   * subscription day = earliest telco verification's verified_at (or its created_at),
--     else profile created_at, converted to Asia/Colombo
--
-- Safe to re-run (CREATE OR REPLACE). The backend falls back to paged table reads if this
-- function is missing, so deploy order does not matter.
-- SECURITY DEFINER (reads across users): EXECUTE only for service_role (the backend key).

CREATE OR REPLACE FUNCTION public.telco_stats_daily_counts(
  test_digits text[] DEFAULT '{}',
  gateway_active boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    -- Earliest verified telco verification per phone (digits only)
    SELECT DISTINCT ON (d.digits)
           d.digits,
           coalesce(pv.verified_at, pv.created_at) AS subscribed_at
    FROM phone_verifications pv
    CROSS JOIN LATERAL (SELECT regexp_replace(coalesce(pv.phone_number, ''), '\D', '', 'g') AS digits) d
    WHERE pv.is_verified = true
      AND pv.otp_hash LIKE 'TELCO:%'
      AND d.digits <> ''
    ORDER BY d.digits, pv.created_at ASC
  ),
  p AS (
    SELECT p.*, regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g') AS digits
    FROM profiles p
  ),
  telco AS (
    SELECT (coalesce(v.subscribed_at, p.created_at) AT TIME ZONE 'Asia/Colombo')::date AS day
    FROM p
    LEFT JOIN v ON v.digits = p.digits AND p.digits <> ''
    WHERE NOT (p.digits = ANY (coalesce(test_digits, '{}')))
      AND coalesce(p.monthly_minutes_allowance, 0) < 9000
      AND (
        nullif(p.telco_subscriber_id, '') IS NOT NULL
        OR nullif(p.telco_provider, '') IS NOT NULL
        OR v.digits IS NOT NULL
        OR (
          gateway_active
          AND (p.billing_cycle = 'daily' OR p.plan_tier = 'starter')
          AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = p.id)
        )
      )
      AND coalesce(v.subscribed_at, p.created_at) IS NOT NULL
  )
  -- One JSON object (not a row set) so PostgREST's max-rows cap cannot truncate it.
  SELECT coalesce(jsonb_object_agg(to_char(day, 'YYYY-MM-DD'), n), '{}'::jsonb)
  FROM (SELECT day, count(*) AS n FROM telco GROUP BY day) t;
$$;

REVOKE EXECUTE ON FUNCTION public.telco_stats_daily_counts(text[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telco_stats_daily_counts(text[], boolean) TO service_role;
