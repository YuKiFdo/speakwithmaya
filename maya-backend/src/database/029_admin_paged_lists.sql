-- 029: Server-side pagination + aggregates for the admin lists.
--
-- Why: several admin pages downloaded whole tables (profiles, complaints, reviews, ledger,
-- subscriptions) to the backend and filtered / counted / paginated them in Node. These
-- functions filter, count and page in Postgres and return only one page of rows (default 10)
-- plus the totals the page shows, so responses stay a few KB no matter how many users exist.
--
-- Safe to re-run (CREATE OR REPLACE / IF NOT EXISTS). The backend falls back to the old reads
-- when a function is missing, so deploy order does not matter.
-- SECURITY DEFINER (reads across users): EXECUTE only for service_role (the backend key).

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_complaints_created ON public.user_complaints (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_complaints_status ON public.user_complaints (status);
CREATE INDEX IF NOT EXISTS idx_sessions_rated_created ON public.sessions (created_at DESC) WHERE user_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- ── Users: activity totals for just the users on one page ───────────────────
-- Same JSON shape as admin_user_activity_stats() (migration 021), restricted to user_ids.
CREATE OR REPLACE FUNCTION public.admin_user_activity_for(user_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (SELECT unnest(user_ids) AS user_id),
  s AS (
    SELECT s.user_id, count(*) AS n, coalesce(sum(s.duration_seconds), 0) AS secs,
           avg(s.overall_score) FILTER (WHERE s.overall_score > 0) AS avg_score,
           max(s.created_at) AS last_at
    FROM sessions s WHERE s.user_id = ANY(user_ids) GROUP BY s.user_id
  ),
  intro AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.duration_seconds, s.status
    FROM sessions s
    WHERE s.user_id = ANY(user_ids)
      AND (lower(coalesce(s.topic, '')) LIKE '%intro%' OR lower(coalesce(s.topic, '')) LIKE '%onboarding%')
    ORDER BY s.user_id, s.created_at DESC
  ),
  l AS (
    SELECT u.user_id, coalesce(sum(u.total_tokens), 0) AS tokens,
           coalesce(sum(u.cost_lkr), 0) AS lkr, coalesce(sum(u.cost_usd), 0) AS usd
    FROM usage_ledger u WHERE u.user_id = ANY(user_ids) GROUP BY u.user_id
  ),
  p AS (
    SELECT r.user_id, count(*) AS attempts,
           count(*) FILTER (WHERE r.status = 'completed' OR r.is_passed) AS completed
    FROM user_roadmap_progress r WHERE r.user_id = ANY(user_ids) GROUP BY r.user_id
  )
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

-- ── Users: KPI banner + 7-day trends (same rules as the Node dataset) ───────
-- test_digits: digits-only phone numbers of registered test accounts (from app config).
CREATE OR REPLACE FUNCTION public.admin_users_summary(test_digits text[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pr AS (
    SELECT p.id, p.plan_tier, p.plan_status, p.created_at,
           (
             (nullif(regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g'), '') = ANY(test_digits))
             OR coalesce(p.monthly_minutes_allowance, 0) >= 9000
             OR coalesce(p.minutes_balance, 0) >= 9000
           ) AS is_test
    FROM profiles p
  ),
  active_sub AS (SELECT DISTINCT user_id FROM subscriptions WHERE status = 'ACTIVE'),
  days AS (
    SELECT ((now() AT TIME ZONE 'Asia/Colombo')::date - g) AS day
    FROM generate_series(0, 6) AS g
  ),
  regs AS (
    SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day, count(*) AS n
    FROM profiles
    WHERE created_at >= now() - interval '8 days'
    GROUP BY 1
  ),
  sess AS (
    SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day, count(*) AS n
    FROM sessions
    WHERE created_at >= now() - interval '8 days'
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM pr),
    'test_accounts', (SELECT count(*) FROM pr WHERE is_test),
    'starter', (SELECT count(*) FROM pr WHERE NOT is_test AND plan_tier = 'starter'),
    'active_paid', (
      SELECT count(*) FROM pr
      WHERE NOT is_test
        AND (pr.id IN (SELECT user_id FROM active_sub) OR (plan_tier <> 'starter' AND plan_status = 'active'))
    ),
    'total_seconds', (SELECT coalesce(sum(duration_seconds), 0) FROM sessions),
    'registrations', (
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(r.n, 0)) ORDER BY d.day)
      FROM days d LEFT JOIN regs r ON r.day = d.day
    ),
    'sessions', (
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(x.n, 0)) ORDER BY d.day)
      FROM days d LEFT JOIN sess x ON x.day = d.day
    )
  );
$$;

-- ── Complaints: filter / search / sort / page + stats ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_complaints_page(
  p_status text DEFAULT NULL,      -- NULL | 'open' | 'resolved'
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',    -- 'newest' | 'oldest'
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.id, c.user_id, c.message, coalesce(c.status, 'open') AS status, c.created_at, c.updated_at,
           coalesce(pf.display_name, c.display_name) AS display_name,
           coalesce(pf.phone_number, c.phone_number) AS phone_number,
           coalesce(pf.email, c.email) AS email,
           coalesce(pf.avatar_url, c.avatar_url) AS avatar_url,
           coalesce(pf.plan_tier, c.plan_tier) AS plan_tier,
           pf.level
    FROM user_complaints c
    LEFT JOIN profiles pf ON pf.id = c.user_id
  ),
  f AS (
    SELECT * FROM base
    WHERE (p_status IS NULL OR (p_status = 'resolved' AND status = 'resolved') OR (p_status = 'open' AND status <> 'resolved'))
      AND (
        coalesce(p_search, '') = ''
        OR display_name ILIKE '%' || p_search || '%'
        OR phone_number ILIKE '%' || p_search || '%'
        OR email ILIKE '%' || p_search || '%'
        OR message ILIKE '%' || p_search || '%'
      )
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'stats', (
      SELECT jsonb_build_object(
        'total', count(*),
        'open', count(*) FILTER (WHERE status <> 'resolved'),
        'resolved', count(*) FILTER (WHERE status = 'resolved'),
        'oldest_open_at', min(created_at) FILTER (WHERE status <> 'resolved')
      ) FROM base
    ),
    'rows', coalesce((
      SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT * FROM f
        ORDER BY CASE WHEN p_sort = 'oldest' THEN created_at END ASC,
                 created_at DESC
        OFFSET greatest(p_offset, 0) LIMIT least(greatest(p_limit, 1), 100)
      ) x
    ), '[]'::jsonb)
  );
$$;

-- ── Session reviews: filter / search / sort / page + dashboard stats ────────
CREATE OR REPLACE FUNCTION public.admin_reviews_page(
  p_star integer DEFAULT NULL,     -- NULL | 1..5 (rounded rating)
  p_content text DEFAULT NULL,     -- NULL | 'WITH_COMMENT' | 'RATING_ONLY'
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',    -- 'newest' | 'oldest' | 'highest' | 'lowest'
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT s.id, s.user_id, s.topic, s.duration_seconds, s.overall_score,
           coalesce(s.user_rating::numeric, 5) AS rating,
           nullif(btrim(s.user_feedback), '') AS feedback,
           coalesce(s.created_at, (to_jsonb(s)->>'start_time')::timestamptz) AS created_at
    FROM sessions s
    WHERE s.user_rating IS NOT NULL
  ),
  j AS (
    SELECT b.*, pf.display_name, pf.phone_number, pf.email, pf.avatar_url, pf.plan_tier, pf.level
    FROM base b LEFT JOIN profiles pf ON pf.id = b.user_id
  ),
  f AS (
    SELECT * FROM j
    WHERE (p_star IS NULL OR least(5, greatest(1, round(rating))) = p_star)
      AND (p_content IS NULL
           OR (p_content = 'WITH_COMMENT' AND feedback IS NOT NULL)
           OR (p_content = 'RATING_ONLY' AND feedback IS NULL))
      AND (
        coalesce(p_search, '') = ''
        OR display_name ILIKE '%' || p_search || '%'
        OR phone_number ILIKE '%' || p_search || '%'
        OR topic ILIKE '%' || p_search || '%'
        OR feedback ILIKE '%' || p_search || '%'
      )
  ),
  days AS (
    SELECT ((now() AT TIME ZONE 'Asia/Colombo')::date - g) AS day FROM generate_series(0, 13) AS g
  ),
  per_day AS (
    SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day, count(*) AS n, avg(rating) AS avg
    FROM base WHERE created_at >= now() - interval '15 days' GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'stats', (
      SELECT jsonb_build_object(
        'total', count(*),
        'avg_rating', coalesce(avg(rating), 0),
        'with_comment', count(*) FILTER (WHERE feedback IS NOT NULL),
        'star_counts', jsonb_build_object(
          '5', count(*) FILTER (WHERE least(5, greatest(1, round(rating))) = 5),
          '4', count(*) FILTER (WHERE least(5, greatest(1, round(rating))) = 4),
          '3', count(*) FILTER (WHERE least(5, greatest(1, round(rating))) = 3),
          '2', count(*) FILTER (WHERE least(5, greatest(1, round(rating))) = 2),
          '1', count(*) FILTER (WHERE least(5, greatest(1, round(rating))) = 1)
        ),
        'last7_count', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        'last7_avg', avg(rating) FILTER (WHERE created_at >= now() - interval '7 days'),
        'prev7_avg', avg(rating) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
        'days', (
          SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(pd.n, 0), 'avg', coalesce(pd.avg, 0)) ORDER BY d.day)
          FROM days d LEFT JOIN per_day pd ON pd.day = d.day
        )
      ) FROM base
    ),
    'rows', coalesce((
      SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT * FROM f
        ORDER BY
          CASE WHEN p_sort = 'highest' THEN rating END DESC,
          CASE WHEN p_sort = 'lowest' THEN rating END ASC,
          CASE WHEN p_sort = 'oldest' THEN created_at END ASC,
          created_at DESC
        OFFSET greatest(p_offset, 0) LIMIT least(greatest(p_limit, 1), 100)
      ) x
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_activity_for(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_users_summary(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_complaints_page(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reviews_page(integer, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_activity_for(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_users_summary(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_complaints_page(text, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reviews_page(integer, text, text, text, integer, integer) TO service_role;

-- ── AI Usage: filter / search / page + exact totals and chart buckets ───────
-- One row per session (latest ledger row wins, as before). Totals and chart buckets cover the
-- WHOLE filtered range (previously they were computed from a capped 300/1000-row download).
-- Optional columns (hint costs from 023, start_time, profile onboarding fields) are read via
-- to_jsonb(row)->>'col', so the migration also runs on databases that lack them.
CREATE OR REPLACE FUNCTION public.admin_usage_page(
  p_from timestamptz,
  p_to timestamptz,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,      -- NULL | 'success' | 'in progress'
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ledger AS (
    SELECT DISTINCT ON (coalesce(l.session_id::text, l.id::text))
           l.id, l.session_id, l.created_at,
           coalesce(nullif(l.duration_seconds, 0), s.duration_seconds, 0) AS secs,
           coalesce(nullif(l.total_tokens, 0),
                    coalesce(l.audio_in_tokens, 0) + coalesce(l.text_in_tokens, 0)
                    + coalesce(l.audio_out_tokens, 0) + coalesce(l.text_out_tokens, 0)) AS tokens,
           coalesce(l.cost_lkr, 0) AS lkr,
           coalesce(l.cost_usd, 0) AS usd,
           coalesce((to_jsonb(s)->>'hints_used_count')::numeric, 0) AS hints,
           coalesce((to_jsonb(s)->>'hint_cost_lkr')::numeric, 0) AS hint_lkr,
           coalesce((to_jsonb(s)->>'hint_cost_usd')::numeric, 0) AS hint_usd,
           (s.status = 'completed') AS ok,
           s.topic, pf.display_name
    FROM usage_ledger l
    LEFT JOIN sessions s ON s.id = l.session_id
    LEFT JOIN profiles pf ON pf.id = s.user_id
    WHERE l.created_at >= p_from AND l.created_at < p_to
    ORDER BY coalesce(l.session_id::text, l.id::text), l.created_at DESC
  ),
  f AS (
    SELECT * FROM ledger
    WHERE (p_status IS NULL OR (p_status = 'success' AND ok) OR (p_status = 'in progress' AND NOT coalesce(ok, false)))
      AND (coalesce(p_search, '') = '' OR display_name ILIKE '%' || p_search || '%' OR topic ILIKE '%' || p_search || '%')
  ),
  colombo AS (
    SELECT (now() AT TIME ZONE 'Asia/Colombo') AS now_local
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'totals', (
      SELECT jsonb_build_object(
        'tokens', coalesce(sum(tokens), 0),
        'cost_lkr', coalesce(sum(lkr), 0),
        'cost_usd', coalesce(sum(usd), 0),
        'hints', coalesce(sum(hints), 0),
        'hint_cost_lkr', coalesce(sum(hint_lkr), 0),
        'hint_cost_usd', coalesce(sum(hint_usd), 0),
        'seconds', coalesce(sum(secs), 0),
        'seconds_today', coalesce(sum(secs) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Colombo')::date = (SELECT now_local::date FROM colombo)), 0),
        'seconds_month', coalesce(sum(secs) FILTER (
          WHERE date_trunc('month', created_at AT TIME ZONE 'Asia/Colombo') = date_trunc('month', (SELECT now_local FROM colombo))), 0)
      ) FROM f
    ),
    'by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'tokens', tokens, 'minutes', minutes, 'lkr', lkr, 'usd', usd, 'n', n))
      FROM (
        SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day, sum(tokens) AS tokens,
               sum(greatest(1, round(secs / 60.0))) AS minutes, sum(lkr) AS lkr, sum(usd) AS usd, count(*) AS n
        FROM f GROUP BY 1
      ) d
    ), '[]'::jsonb),
    'by_hour', coalesce((
      SELECT jsonb_agg(jsonb_build_object('hour', hour, 'tokens', tokens, 'minutes', minutes, 'lkr', lkr, 'usd', usd, 'n', n))
      FROM (
        SELECT extract(hour FROM created_at AT TIME ZONE 'Asia/Colombo')::int AS hour, sum(tokens) AS tokens,
               sum(greatest(1, round(secs / 60.0))) AS minutes, sum(lkr) AS lkr, sum(usd) AS usd, count(*) AS n
        FROM f GROUP BY 1
      ) h
    ), '[]'::jsonb),
    'ids', coalesce((
      SELECT jsonb_agg(x.id ORDER BY x.created_at DESC) FROM (
        SELECT id, created_at FROM f ORDER BY created_at DESC
        OFFSET greatest(p_offset, 0) LIMIT least(greatest(p_limit, 1), 100)
      ) x
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_usage_page(timestamptz, timestamptz, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_page(timestamptz, timestamptz, text, text, integer, integer) TO service_role;

-- ── Dashboard: every analytics count in one query (real learners only) ──────
-- Same test-account rule as the Node code. Returns raw count maps; the backend adds labels,
-- colours and percentages. Replaces downloading every profile + language event per rebuild.
CREATE OR REPLACE FUNCTION public.admin_analytics_summary(
  test_ids uuid[] DEFAULT '{}',
  test_digits text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pr AS (
    SELECT p.*, to_jsonb(p) AS j, regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g') AS digits
    FROM profiles p
  ),
  real AS (
    SELECT * FROM pr
    WHERE NOT (
      pr.id = ANY(test_ids)
      OR (pr.digits <> '' AND pr.digits = ANY(test_digits))
      OR coalesce(pr.monthly_minutes_allowance, 0) >= 9000
      OR coalesce(pr.minutes_balance, 0) >= 9000
      OR lower(coalesce(pr.display_name, '')) LIKE 'test%'
      OR lower(coalesce(pr.display_name, '')) LIKE '%test user%'
      OR lower(coalesce(pr.display_name, '')) LIKE '%qa automation%'
      OR pr.digits LIKE '94770000%'
      OR pr.digits LIKE '94710000%'
    )
  ),
  -- Latest language-mode choice per real user, else the profile column
  ev AS (
    SELECT DISTINCT ON (e.user_id) e.user_id,
           coalesce(nullif(e.metadata->>'languageMode', ''), nullif(e.metadata->>'mode', '')) AS mode
    FROM onboarding_events e
    JOIN real r ON r.id = e.user_id
    WHERE e.event_name = 'select_language_mode'
      AND coalesce(nullif(e.metadata->>'languageMode', ''), nullif(e.metadata->>'mode', '')) IS NOT NULL
    ORDER BY e.user_id, e.created_at DESC
  ),
  lang AS (
    -- r.j (to_jsonb): works whether or not profiles.language_mode exists (migration 016 is optional)
    SELECT coalesce(ev.mode, nullif(r.j->>'language_mode', '')) AS mode
    FROM real r LEFT JOIN ev ON ev.user_id = r.id
  ),
  days AS (
    SELECT ((now() AT TIME ZONE 'Asia/Colombo')::date - g) AS day FROM generate_series(0, 13) AS g
  ),
  regs AS (
    SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day, count(*) AS n
    FROM real WHERE created_at >= now() - interval '15 days' GROUP BY 1
  ),
  sess AS (
    SELECT (s.created_at AT TIME ZONE 'Asia/Colombo')::date AS day, count(*) AS n
    FROM sessions s JOIN real r ON r.id = s.user_id
    WHERE s.created_at >= now() - interval '15 days' GROUP BY 1
  ),
  cnt AS (
    SELECT key, count(*) AS n, kind FROM (
      SELECT 'level' AS kind, lower(btrim(coalesce(j->>'level', ''))) AS key FROM real
      UNION ALL SELECT 'goal', lower(btrim(coalesce(nullif(j->>'goal', ''), 'unset'))) FROM real
      UNION ALL SELECT 'tier', lower(btrim(coalesce(nullif(plan_tier, ''), 'starter'))) FROM real
      UNION ALL SELECT 'status', lower(btrim(coalesce(nullif(plan_status, ''), 'active'))) FROM real
      UNION ALL SELECT 'daily', CASE WHEN j->>'daily_goal_minutes' IN ('10', '15', '30') THEN j->>'daily_goal_minutes' ELSE '5' END FROM real
      UNION ALL SELECT 'employment', lower(btrim(coalesce(nullif(j->>'employment_status', ''), 'unset'))) FROM real
      UNION ALL SELECT 'lang', mode FROM lang WHERE mode IS NOT NULL
    ) x GROUP BY kind, key
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM real),
    'counts', (
      SELECT coalesce(jsonb_object_agg(kind, m), '{}'::jsonb) FROM (
        SELECT kind, jsonb_object_agg(key, n) AS m FROM cnt GROUP BY kind
      ) k
    ),
    'sessions_total', (SELECT count(*) FROM sessions s JOIN real r ON r.id = s.user_id),
    'seconds_total', (SELECT coalesce(sum(s.duration_seconds), 0) FROM sessions s JOIN real r ON r.id = s.user_id),
    'ledger', (
      SELECT jsonb_build_object(
        'tokens', coalesce(sum(u.total_tokens), 0),
        'lkr', coalesce(sum(u.cost_lkr), 0),
        'usd', coalesce(sum(u.cost_usd), 0)
      ) FROM usage_ledger u JOIN real r ON r.id = u.user_id
    ),
    'registrations', (
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(x.n, 0)) ORDER BY d.day)
      FROM days d LEFT JOIN regs x ON x.day = d.day
    ),
    'sessions', (
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(x.n, 0)) ORDER BY d.day)
      FROM days d LEFT JOIN sess x ON x.day = d.day
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analytics_summary(uuid[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary(uuid[], text[]) TO service_role;
