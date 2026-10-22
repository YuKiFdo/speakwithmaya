-- ==============================================================================
-- Maya AI Migration 011: Telco Carrier Billing (IdeaMart & mSpace) Subscriber Fields
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telco_provider TEXT CHECK (telco_provider IN ('ideamart', 'mspace')),
  ADD COLUMN IF NOT EXISTS telco_subscriber_id TEXT,
  ADD COLUMN IF NOT EXISTS telco_reference_no TEXT;

ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS reference_no TEXT,
  ADD COLUMN IF NOT EXISTS telco_provider TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_telco_subscriber_id
  ON public.profiles (telco_subscriber_id)
  WHERE telco_subscriber_id IS NOT NULL;
