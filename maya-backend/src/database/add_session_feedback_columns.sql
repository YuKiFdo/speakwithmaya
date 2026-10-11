-- Migration: Add user_rating and user_feedback columns to public.sessions
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS user_rating INTEGER,
ADD COLUMN IF NOT EXISTS user_feedback TEXT;
