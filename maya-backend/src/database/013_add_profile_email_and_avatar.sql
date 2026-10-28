-- ==============================================================================
-- Migration 013: Add email and avatar_url columns to public.profiles
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
