-- Migration 019: Add source and type columns to public.grammar_corrections
-- Distinguishes real-time on-call corrections from post-session transcript analysis corrections
ALTER TABLE public.grammar_corrections
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'on_call',
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'grammar';

CREATE INDEX IF NOT EXISTS idx_grammar_corrections_source ON public.grammar_corrections(session_id, source);

