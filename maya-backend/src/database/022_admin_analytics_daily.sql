-- 022: Per-user, per-day session counts for the admin Analytics page.
--
-- Why: the Analytics overview downloaded every session and usage_ledger row to compute totals
-- and a 14-day trend for real (non-test) users. With this function plus
-- admin_user_activity_stats (migration 021) it receives only per-user totals and at most
-- users x days trend rows. The backend still decides which users are test accounts, so the
-- numbers are unchanged. Falls back to the old reads if this is not applied.
--
-- Safe to re-run. Requires 021 (indexes). Service-role only (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.admin_user_sessions_per_day(days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- One JSON array so PostgREST's max-rows cap (1000) cannot truncate it.
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', t.user_id, 'day', t.day, 'sessions', t.n)), '[]'::jsonb)
  FROM (
    SELECT s.user_id,
           (s.created_at AT TIME ZONE 'Asia/Colombo')::date AS day,
           count(*) AS n
    FROM sessions s
    WHERE s.created_at >= now() - make_interval(days => greatest(days, 1) + 1)
    GROUP BY 1, 2
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_sessions_per_day(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_sessions_per_day(integer) TO service_role;
