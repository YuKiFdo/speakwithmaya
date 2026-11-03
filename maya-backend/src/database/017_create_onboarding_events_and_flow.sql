-- Migration 017: Create onboarding_events table and add onboarding_flow to public.profiles
-- Enables end-to-end tracking of student onboarding journey, option clicks, wheel spins,
-- discount claims, plan selection, and starter vs. paid conversion.

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  step TEXT NOT NULL,
  action TEXT DEFAULT 'click',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_id ON public.onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created_at ON public.onboarding_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_event_name ON public.onboarding_events(event_name);

-- Append-only array of student's journey events directly on the profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_flow JSONB DEFAULT '[]'::jsonb;
