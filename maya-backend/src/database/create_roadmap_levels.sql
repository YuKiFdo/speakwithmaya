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
  scenario_prompt TEXT DEFAULT '',
  opening_mode TEXT DEFAULT 'maya_explains_first',
  opening_line TEXT DEFAULT '',
  scenario_briefing TEXT DEFAULT '',
  emotion_tags TEXT[] DEFAULT '{"neutral"}',
  is_scenario_mode BOOLEAN DEFAULT true,
  user_role TEXT DEFAULT '',
  maya_role TEXT DEFAULT '',
  goal_title TEXT DEFAULT '',
  goal_description TEXT DEFAULT '',
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
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS scenario_prompt TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS opening_mode TEXT DEFAULT 'maya_explains_first';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS opening_line TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS scenario_briefing TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS emotion_tags TEXT[] DEFAULT '{"neutral"}';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS is_scenario_mode BOOLEAN DEFAULT true;
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS maya_role TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS goal_title TEXT DEFAULT '';
ALTER TABLE public.roadmap_levels ADD COLUMN IF NOT EXISTS goal_description TEXT DEFAULT '';

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