-- Migration 018: Add summary column to public.sessions for AI-generated conversation summaries
-- This properly separates user review comments (user_feedback) from AI conversation recaps (summary)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS summary TEXT;

