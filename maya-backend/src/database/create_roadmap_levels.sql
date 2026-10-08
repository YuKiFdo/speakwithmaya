-- ==============================================================================
-- Maya AI: Roadmap Levels Schema & Migration for Supabase
-- Run this in your Supabase Project > SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.roadmap_levels (
  id TEXT PRIMARY KEY,
  level_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  target_duration_minutes INTEGER DEFAULT 5,
  icon_type TEXT DEFAULT 'chat',
  number_color TEXT DEFAULT '#0057FF',
  halo_color TEXT DEFAULT '#EFF6FF',
  halo_border_color TEXT DEFAULT '#BFDBFE',
  scenario_id TEXT DEFAULT 'general-practice',
  custom_svg TEXT DEFAULT '',
  practice_points JSONB DEFAULT '[]'::jsonb,
  canonical_content TEXT DEFAULT '',
  xp_reward INTEGER DEFAULT 100,
  passing_score_percent INTEGER DEFAULT 75,
  guided_prompt JSONB DEFAULT '{}'::jsonb,
  unlock_rule JSONB DEFAULT '{"type": "score", "minScore": 75}'::jsonb,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist if the table was previously created with fewer columns
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS practice_points JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS canonical_content TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS custom_svg TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 100;
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER DEFAULT 75;

-- Enable Row Level Security
ALTER TABLE public.roadmap_levels ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "Everyone can read published roadmap levels" ON public.roadmap_levels;
CREATE POLICY "Everyone can read published roadmap levels" ON public.roadmap_levels
  FOR SELECT USING (true);

-- Allow backend service role / admin full write access
DROP POLICY IF EXISTS "Service role has full access to roadmap levels" ON public.roadmap_levels;
CREATE POLICY "Service role has full access to roadmap levels" ON public.roadmap_levels
  FOR ALL USING (true);
