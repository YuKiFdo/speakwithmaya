-- 028: The XP total the learner has already seen animated on the dashboard.
-- The dashboard animates (totalXp - last_seen_xp) once, then saves the new total here, so the
-- "+XP" fill plays exactly once across every device (phone app, mobile web, desktop web).
-- NULL = never set: the app sets it to the current total silently (no fake "+1200 XP").

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_xp integer;
