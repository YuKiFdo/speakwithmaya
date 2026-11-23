-- 030: In-app guided tours the learner has already seen (e.g. 'dashboard-welcome:v1').
-- Stored on the profile so a tour shows once per learner across every device
-- (phone app, mobile web, desktop web). The app also caches it locally, so this is read
-- at most once per app session and only while a tour is still unseen on that device.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tours_seen text[] NOT NULL DEFAULT '{}';
