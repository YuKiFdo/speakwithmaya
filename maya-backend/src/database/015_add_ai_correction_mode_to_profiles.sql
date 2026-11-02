-- ==============================================================================
-- Migration 015: Add ai_correction_mode column to public.profiles
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_correction_mode TEXT DEFAULT 'keep_on_track';
