-- 021: Indexes for hot query paths + server-side aggregates for the admin pages.
--
-- Why: the admin Users / AI Usage pages downloaded whole tables (every session, every ledger
-- row, every session turn) from Supabase (Singapore) to the backend (Sydney) and counted them
-- in Node. These functions return only the per-user totals / per-session counts instead, which
-- cuts response size from megabytes to kilobytes and saves egress.
--
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE). The backend falls back to the old
-- whole-table reads if these functions are missing, so apply order does not matter.
--
-- Functions are SECURITY DEFINER (they read across all users), so EXECUTE is revoked from
-- anon/authenticated and granted only to service_role (the backend key).

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON public.sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user ON public.usage_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_session ON public.usage_ledger (session_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_created_at ON public.usage_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_turns_session ON public.session_turns (session_id);
CREATE INDEX IF NOT EXISTS idx_grammar_corrections_session ON public.grammar_corrections (session_id);

-- ── Per-user activity totals for the admin Users page ───────────────────────
-- One JSON object per user who has any sessions, ledger rows or roadmap progress.
CREATE OR REPLACE FUNCTION public.admin_user_activity_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT s.user_id,
           count(*) AS n,
           coalesce(sum(s.duration_seconds), 0) AS secs,
           avg(s.overall_score) FILTER (WHERE s.overall_score > 0) AS avg_score,
           max(s.created_at) AS last_at
    FROM sessions s
    GROUP BY s.user_id
  ),
  intro AS (
    -- Most recent intro/onboarding call per user (same rule as resolveOnboardingCallStatus)
    SELECT DISTINCT ON (s.user_id) s.user_id, s.duration_seconds, s.status
    FROM sessions s
    WHERE lower(coalesce(s.topic, '')) LIKE '%intro%'
       OR lower(coalesce(s.topic, '')) LIKE '%onboarding%'
    ORDER BY s.user_id, s.created_at DESC
  ),
  l AS (
    SELECT u.user_id,
           coalesce(sum(u.total_tokens), 0) AS tokens,
           coalesce(sum(u.cost_lkr), 0) AS lkr,
           coalesce(sum(u.cost_usd), 0) AS usd
    FROM usage_ledger u
    GROUP BY u.user_id
  ),
  p AS (
    SELECT r.user_id,
           count(*) AS attempts,
           count(*) FILTER (WHERE r.status = 'completed' OR r.is_passed) AS completed
    FROM user_roadmap_progress r
    GROUP BY r.user_id
  ),
  ids AS (
    SELECT user_id FROM s UNION SELECT user_id FROM l UNION SELECT user_id FROM p
  )
  -- One JSON array (not a row set) so PostgREST's max-rows cap (1000) cannot truncate it.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', ids.user_id,
           'total_sessions', coalesce(s.n, 0),
           'total_seconds', coalesce(s.secs, 0),
           'avg_score', s.avg_score,
           'last_session_at', s.last_at,
           'intro_duration', intro.duration_seconds,
           'intro_status', intro.status,
           'total_tokens', coalesce(l.tokens, 0),
           'total_cost_lkr', coalesce(l.lkr, 0),
           'total_cost_usd', coalesce(l.usd, 0),
           'progress_attempts', coalesce(p.attempts, 0),
           'progress_completed', coalesce(p.completed, 0)
         )), '[]'::jsonb)
  FROM ids
  LEFT JOIN s ON s.user_id = ids.user_id
  LEFT JOIN intro ON intro.user_id = ids.user_id
  LEFT JOIN l ON l.user_id = ids.user_id
  LEFT JOIN p ON p.user_id = ids.user_id;
$$;

-- ── Sessions per Sri Lanka day (admin trend charts) ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_sessions_per_day(days integer DEFAULT 14)
RETURNS TABLE (day date, sessions bigint, seconds bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (s.created_at AT TIME ZONE 'Asia/Colombo')::date AS day,
         count(*),
         coalesce(sum(s.duration_seconds), 0)
  FROM sessions s
  WHERE s.created_at >= now() - make_interval(days => greatest(days, 1) + 1)
  GROUP BY 1;
$$;

-- ── Turn / correction counts for a page of sessions (admin AI Usage page) ───
CREATE OR REPLACE FUNCTION public.admin_session_counts(session_ids uuid[])
RETURNS TABLE (session_id uuid, turns bigint, corrections bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id.session_id,
         (SELECT count(*) FROM session_turns t WHERE t.session_id = id.session_id),
         (SELECT count(*) FROM grammar_corrections g WHERE g.session_id = id.session_id)
  FROM unnest(session_ids) AS id(session_id);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_activity_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_sessions_per_day(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_session_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_activity_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_sessions_per_day(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_session_counts(uuid[]) TO service_role;
