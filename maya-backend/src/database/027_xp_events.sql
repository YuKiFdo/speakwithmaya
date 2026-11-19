-- 027: XP ledger for XP that is earned by events (not derivable from sessions/progress rows).
-- First source: 'streak_bonus' (hint-free turn streaks in live calls, see src/sessions/xp-rules.ts).
-- Total XP = roadmap progress XP + practice minutes x 5 + SUM(xp_events.amount).

CREATE TABLE IF NOT EXISTS public.xp_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id  uuid,
  source      text NOT NULL,
  amount      integer NOT NULL CHECK (amount >= 0),
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- one award per session per source: finalize can run twice (reconnect / HTTP finish + socket close)
  CONSTRAINT xp_events_session_source_unique UNIQUE (session_id, source)
);

CREATE INDEX IF NOT EXISTS xp_events_user_created_idx ON public.xp_events (user_id, created_at);

-- Server (service role) only; clients never read or write this table directly.
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
