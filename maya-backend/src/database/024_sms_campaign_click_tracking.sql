-- 024: SMS broadcast campaigns with per-recipient click tracking.
--
-- Why: admins want to attach a link to an SMS broadcast and see how many users clicked it
-- and came back to practise. Each recipient gets a unique token in the link
-- (https://app.speakwithmaya.com/...?r=<token>); the web app reports the click when it
-- opens, and the admin view joins clicks with sessions started afterwards.
--
-- Safe to re-run. Until applied, broadcasts with a link still send (without tracking) and
-- the admin campaigns list shows a "migration not applied" notice.

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  message       TEXT NOT NULL,
  link_url      TEXT NOT NULL,          -- destination before the ?r=<token> parameter
  audience      TEXT NOT NULL,
  recipients    INTEGER NOT NULL DEFAULT 0,
  sent          INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_campaign_recipients (
  token             TEXT PRIMARY KEY,   -- unique per recipient, carried in the link
  campaign_id       UUID NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  user_id           UUID,               -- matched by phone number when the SMS was sent
  phone             TEXT NOT NULL,
  sent_ok           BOOLEAN,
  click_count       INTEGER NOT NULL DEFAULT 0,
  first_clicked_at  TIMESTAMPTZ,
  last_clicked_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_campaign_recipients_campaign_idx
  ON public.sms_campaign_recipients (campaign_id);

-- Only the backend (service key) reads/writes these tables.
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Atomic click recording (avoids read-modify-write races when a link is opened twice).
CREATE OR REPLACE FUNCTION public.record_sms_click(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sms_campaign_recipients
     SET click_count      = click_count + 1,
         first_clicked_at = COALESCE(first_clicked_at, now()),
         last_clicked_at  = now()
   WHERE token = p_token
  RETURNING TRUE;
$$;
REVOKE ALL ON FUNCTION public.record_sms_click(TEXT) FROM PUBLIC, anon, authenticated;
