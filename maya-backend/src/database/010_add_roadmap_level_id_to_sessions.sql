-- ==============================================================================
-- Maya AI Migration 010: Add roadmap_level_id and metadata columns to public.sessions
-- ==============================================================================

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS roadmap_level_id TEXT,
ADD COLUMN IF NOT EXISTS level_number INTEGER,
ADD COLUMN IF NOT EXISTS scenario_id TEXT,
ADD COLUMN IF NOT EXISTS scenario_title TEXT,
ADD COLUMN IF NOT EXISTS hints_used_count INTEGER DEFAULT 0;
