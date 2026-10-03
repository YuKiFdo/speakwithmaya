-- Maya AI: Core Supabase Schema for Profiles, Sessions, Turns, Grammar Corrections, and Ledger

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  display_name TEXT,
  level TEXT DEFAULT 'Intermediate',
  goal TEXT,
  challenge TEXT,
  minutes_balance INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Practice Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  topic TEXT,
  overall_score INTEGER DEFAULT 80,
  fluency_score INTEGER DEFAULT 82,
  grammar_score INTEGER DEFAULT 78,
  pronunciation_score INTEGER DEFAULT 80,
  status TEXT CHECK (status IN ('active', 'completed', 'dropped')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conversation Turns & Transcript
CREATE TABLE IF NOT EXISTS public.session_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  turn_order INTEGER NOT NULL,
  role TEXT CHECK (role IN ('user', 'model')) NOT NULL,
  text_transcript TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Real-Time Grammar Corrections & Rephrasings
CREATE TABLE IF NOT EXISTS public.grammar_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  turn_id UUID REFERENCES public.session_turns(id) ON DELETE SET NULL,
  student_said TEXT NOT NULL,
  more_natural TEXT NOT NULL,
  explanation TEXT NOT NULL,
  highlight_words TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Usage Ledger (Append-Only Cost & Token Accounting)
CREATE TABLE IF NOT EXISTS public.usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_in_tokens INTEGER DEFAULT 0,
  audio_out_tokens INTEGER DEFAULT 0,
  text_in_tokens INTEGER DEFAULT 0,
  text_out_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(8, 6) DEFAULT 0.0,
  cost_lkr NUMERIC(8, 2) DEFAULT 0.0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users read/update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users access own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users access own session turns" ON public.session_turns;
DROP POLICY IF EXISTS "Users access own grammar corrections" ON public.grammar_corrections;
DROP POLICY IF EXISTS "Users read own usage ledger" ON public.usage_ledger;

CREATE POLICY "Users read/update own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users access own sessions" ON public.sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own session turns" ON public.session_turns
  FOR ALL USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE POLICY "Users access own grammar corrections" ON public.grammar_corrections
  FOR ALL USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE POLICY "Users read own usage ledger" ON public.usage_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Roadmap Levels (Admin Configured Curriculum)
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
  guided_prompt JSONB DEFAULT '{}'::jsonb,
  unlock_rule JSONB DEFAULT '{"type": "score", "minScore": 75}'::jsonb,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Roadmap Progress
CREATE TABLE IF NOT EXISTS public.user_roadmap_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id TEXT NOT NULL REFERENCES public.roadmap_levels(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')) DEFAULT 'locked',
  best_score INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, level_id)
);

ALTER TABLE public.roadmap_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roadmap_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read published roadmap levels" ON public.roadmap_levels
  FOR SELECT USING (is_published = true);

CREATE POLICY "Users access own roadmap progress" ON public.user_roadmap_progress
  FOR ALL USING (auth.uid() = user_id);

