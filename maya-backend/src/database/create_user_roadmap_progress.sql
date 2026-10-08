-- ==============================================================================
-- Maya AI: User Roadmap Progress & Completion Schema for Supabase
-- Links user, roadmap level, and session (foreign key)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_roadmap_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_level_id TEXT NOT NULL REFERENCES public.roadmap_levels(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('locked', 'in_progress', 'completed')) DEFAULT 'completed',
  score_percent INTEGER DEFAULT 75,
  is_passed BOOLEAN DEFAULT true,
  xp_earned INTEGER DEFAULT 100,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, roadmap_level_id)
);

-- Indexes for lightning-fast roadmap & user progress queries
CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_user ON public.user_roadmap_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_level ON public.user_roadmap_progress(roadmap_level_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_session ON public.user_roadmap_progress(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_roadmap_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own progress
DROP POLICY IF EXISTS "Users access own roadmap progress" ON public.user_roadmap_progress;
CREATE POLICY "Users access own roadmap progress" ON public.user_roadmap_progress
  FOR ALL USING (auth.uid() = user_id);

-- Allow backend service role / admin full access
DROP POLICY IF EXISTS "Service role has full access to user roadmap progress" ON public.user_roadmap_progress;
CREATE POLICY "Service role has full access to user roadmap progress" ON public.user_roadmap_progress
  FOR ALL USING (true);
