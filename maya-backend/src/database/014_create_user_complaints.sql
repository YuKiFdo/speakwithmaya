-- ==============================================================================
-- Migration 014: Create public.user_complaints table for Student Complaints & Feedback
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT,
  phone_number TEXT,
  email TEXT,
  avatar_url TEXT,
  plan_tier TEXT DEFAULT 'starter',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_complaints_created_at ON public.user_complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_complaints_user_id ON public.user_complaints(user_id);
