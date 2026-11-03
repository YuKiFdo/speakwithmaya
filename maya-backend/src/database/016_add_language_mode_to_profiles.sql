-- Migration 016: Add language_mode to public.profiles
-- Supports 3 coaching options: 'english_only', 'sinhala_support', 'deep_guidance'

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_mode TEXT DEFAULT 'english_only';
