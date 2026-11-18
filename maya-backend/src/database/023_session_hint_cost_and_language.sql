-- 023: Persist per-session hint cost and language settings.
--
-- Why: hint tokens/cost and the session's language mode / Sinhala style were kept only in
-- backend memory, so after every restart (each deploy) the admin AI Usage page showed hint
-- cost LKR 0.00 and "Sinhala (Balanced)" for older sessions. The backend writes these when a
-- session finishes and reads them back, falling back to memory for sessions saved before this.
--
-- Safe to re-run. Until applied, the backend keeps working without these columns.

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS hint_tokens INTEGER;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS hint_cost_usd NUMERIC(10, 6);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS hint_cost_lkr NUMERIC(10, 2);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS language_mode TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS sinhala_style TEXT;
