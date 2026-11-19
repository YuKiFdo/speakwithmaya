-- 025: Backfill sessions whose usage was finalized early because of a mid-call reconnect.
--
-- Bug (fixed in live.gateway.ts / sessions.service.ts): a socket drop finalized the session after the
-- first segment, and the later full finalize was ignored, so usage_ledger / sessions kept a short duration.
-- session_diagnostics gets one row per socket close, with duration measured from the FIRST connect, so
-- MAX(duration_seconds) per session is the real length.
--
-- Tokens/cost: the real token counts were never stored, so they are ESTIMATED by scaling the saved
-- first-segment values by (real_seconds / ledger_seconds). Learner minutes are NOT re-charged.
--
-- Run STEP 1 first and review. Then run STEP 2.

-- ── STEP 1: preview affected sessions with estimated values ─────────────────────
WITH real AS (
  SELECT session_id, MAX(duration_seconds) AS real_seconds, COUNT(*) AS socket_segments
  FROM public.session_diagnostics
  GROUP BY session_id
)
SELECT ul.session_id,
       ul.created_at,
       ul.duration_seconds                                             AS ledger_seconds,
       r.real_seconds,
       r.socket_segments,
       ROUND(r.real_seconds::numeric / ul.duration_seconds, 2)         AS scale,
       ul.total_tokens                                                 AS old_tokens,
       ROUND(ul.total_tokens * r.real_seconds::numeric / ul.duration_seconds) AS est_tokens,
       ul.cost_lkr                                                     AS old_cost_lkr,
       ROUND(ul.cost_lkr * r.real_seconds::numeric / ul.duration_seconds, 2)  AS est_cost_lkr
FROM public.usage_ledger ul
JOIN real r ON r.session_id = ul.session_id::text
WHERE ul.duration_seconds > 0
  AND r.real_seconds > ul.duration_seconds + 30
ORDER BY ul.created_at DESC;

-- ── STEP 2: apply ───────────────────────────────────────────────────────────────
BEGIN;

-- Sessions first (its WHERE compares against the ledger's still-old duration).
WITH real AS (
  SELECT session_id, MAX(duration_seconds) AS real_seconds
  FROM public.session_diagnostics
  GROUP BY session_id
)
UPDATE public.sessions s
SET duration_seconds = r.real_seconds,
    start_time = s.end_time - make_interval(secs => r.real_seconds)
FROM real r
JOIN public.usage_ledger ul ON ul.session_id::text = r.session_id
WHERE r.session_id = s.id::text
  AND ul.duration_seconds > 0
  AND r.real_seconds > ul.duration_seconds + 30;

-- Ledger: duration + scaled tokens/cost (SET expressions read the old row values).
WITH real AS (
  SELECT session_id, MAX(duration_seconds) AS real_seconds
  FROM public.session_diagnostics
  GROUP BY session_id
)
UPDATE public.usage_ledger ul
SET duration_seconds = r.real_seconds,
    audio_in_tokens  = ROUND(ul.audio_in_tokens  * r.real_seconds::numeric / ul.duration_seconds),
    audio_out_tokens = ROUND(ul.audio_out_tokens * r.real_seconds::numeric / ul.duration_seconds),
    text_in_tokens   = ROUND(ul.text_in_tokens   * r.real_seconds::numeric / ul.duration_seconds),
    text_out_tokens  = ROUND(ul.text_out_tokens  * r.real_seconds::numeric / ul.duration_seconds),
    total_tokens     = ROUND(ul.total_tokens     * r.real_seconds::numeric / ul.duration_seconds),
    cost_usd         = ROUND(ul.cost_usd * r.real_seconds::numeric / ul.duration_seconds, 6),
    cost_lkr         = ROUND(ul.cost_lkr * r.real_seconds::numeric / ul.duration_seconds, 2)
FROM real r
WHERE r.session_id = ul.session_id::text
  AND ul.duration_seconds > 0
  AND r.real_seconds > ul.duration_seconds + 30;

-- Check the row counts above, then COMMIT (or ROLLBACK if anything looks wrong).
COMMIT;
