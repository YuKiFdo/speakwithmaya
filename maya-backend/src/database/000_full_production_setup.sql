-- ==============================================================================
-- Maya AI: Complete Production Database Schema Setup
-- Run this entire file once in Supabase Dashboard -> SQL Editor (sjhvhjxbkpidrjbpiqfw)
-- ==============================================================================

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  display_name TEXT,
  level TEXT DEFAULT 'Intermediate',
  goal TEXT,
  challenge TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('starter', 'basic', 'pro', 'premium')) DEFAULT 'starter',
  plan_status TEXT CHECK (plan_status IN ('active', 'trialing', 'past_due', 'canceled')) DEFAULT 'active',
  billing_cycle TEXT CHECK (billing_cycle IN ('daily', 'monthly', 'quarterly', 'yearly')) DEFAULT 'monthly',
  monthly_minutes_allowance INTEGER DEFAULT 10,
  add_on_minutes_balance INTEGER DEFAULT 0,
  minutes_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  native_language TEXT DEFAULT 'sinhala',
  employment_status TEXT,
  daily_goal_minutes INTEGER DEFAULT 10,
  baseline_fluency_score INTEGER DEFAULT 0,
  baseline_grammar_score INTEGER DEFAULT 0,
  baseline_pronunciation_score INTEGER DEFAULT 0,
  last_active_step TEXT DEFAULT '/onboarding/personalized-plan',
  onboarding_completed_at TIMESTAMPTZ,
  minutes_balance INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_number_unique
  ON public.profiles (phone_number)
  WHERE phone_number IS NOT NULL AND phone_number != '';

-- 2. Practice Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  topic TEXT,
  overall_score INTEGER DEFAULT 80,
  fluency_score INTEGER DEFAULT 82,
  grammar_score INTEGER DEFAULT 78,
  pronunciation_score INTEGER DEFAULT 80,
  user_rating INTEGER,
  user_feedback TEXT,
  roadmap_level_id TEXT,
  level_number INTEGER,
  scenario_id TEXT,
  scenario_title TEXT,
  hints_used_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'completed', 'dropped')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conversation Turns & Transcript
CREATE TABLE IF NOT EXISTS public.session_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  turn_order INTEGER NOT NULL,
  role TEXT CHECK (role IN ('user', 'model')) NOT NULL,
  text_transcript TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Real-Time Grammar Corrections & Rephrasings
CREATE TABLE IF NOT EXISTS public.grammar_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  turn_id UUID REFERENCES public.session_turns(id) ON DELETE SET NULL,
  student_said TEXT NOT NULL,
  more_natural TEXT NOT NULL,
  explanation TEXT NOT NULL,
  highlight_words TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Usage Ledger (Append-Only Cost & Token Accounting)
CREATE TABLE IF NOT EXISTS public.usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_in_tokens INTEGER DEFAULT 0,
  audio_out_tokens INTEGER DEFAULT 0,
  text_in_tokens INTEGER DEFAULT 0,
  text_out_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(8, 6) DEFAULT 0.0,
  cost_lkr NUMERIC(8, 2) DEFAULT 0.0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Roadmap Levels (Admin Configured Curriculum & Scenarios)
CREATE TABLE IF NOT EXISTS public.roadmap_levels (
  id TEXT PRIMARY KEY,
  level_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  target_duration_minutes INTEGER DEFAULT 5,
  icon_type TEXT DEFAULT 'chat',
  number_color TEXT DEFAULT '#0057FF',
  halo_color TEXT DEFAULT '#EFF6FF',
  halo_border_color TEXT DEFAULT '#BFDBFE',
  scenario_id TEXT DEFAULT 'general-practice',
  custom_svg TEXT DEFAULT '',
  practice_points JSONB DEFAULT '[]'::jsonb,
  canonical_content TEXT DEFAULT '',
  xp_reward INTEGER DEFAULT 100,
  passing_score_percent INTEGER DEFAULT 75,
  guided_prompt JSONB DEFAULT '{}'::jsonb,
  unlock_rule JSONB DEFAULT '{"type": "score", "minScore": 75}'::jsonb,
  scenario_prompt TEXT DEFAULT '',
  opening_mode TEXT DEFAULT 'maya_explains_first',
  opening_line TEXT DEFAULT '',
  scenario_briefing TEXT DEFAULT '',
  emotion_tags TEXT[] DEFAULT '{"neutral"}',
  is_scenario_mode BOOLEAN DEFAULT true,
  user_role TEXT DEFAULT '',
  maya_role TEXT DEFAULT '',
  goal_title TEXT DEFAULT '',
  goal_description TEXT DEFAULT '',
  tts_script_english TEXT DEFAULT '',
  tts_script_sinhala TEXT DEFAULT '',
  audio_url_english TEXT DEFAULT '',
  audio_url_sinhala TEXT DEFAULT '',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Roadmap Progress
CREATE TABLE IF NOT EXISTS public.user_roadmap_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_level_id TEXT NOT NULL REFERENCES public.roadmap_levels(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')) DEFAULT 'completed',
  score_percent INTEGER DEFAULT 75,
  is_passed BOOLEAN DEFAULT true,
  xp_earned INTEGER DEFAULT 100,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, roadmap_level_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_user ON public.user_roadmap_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_level ON public.user_roadmap_progress(roadmap_level_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmap_progress_session ON public.user_roadmap_progress(session_id);

-- 8. Session Diagnostics & Network Performance Logs
CREATE TABLE IF NOT EXISTS public.session_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  turns_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  max_latency_ms INTEGER DEFAULT 0,
  slow_turns_count INTEGER DEFAULT 0,
  backpressure_warnings INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Phone OTP Verification & Rate-Limiting Table
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone
  ON public.phone_verifications(phone_number, created_at DESC);

-- 10. Subscriptions Table (PayHere Recurring Billing)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payhere_subscription_id TEXT UNIQUE,
  customer_token TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('starter', 'basic', 'pro', 'premium')) NOT NULL,
  billing_cycle TEXT NOT NULL,
  amount_lkr NUMERIC(10, 2) NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'COMPLETED')) DEFAULT 'PENDING',
  next_billing_date DATE,
  installments_paid INTEGER DEFAULT 0,
  card_holder_name TEXT,
  card_masked TEXT,
  card_expiry TEXT,
  payment_method TEXT,
  last_payment_id TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payhere_id ON public.subscriptions(payhere_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_token ON public.subscriptions(customer_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_user_unique
  ON public.subscriptions (user_id)
  WHERE status = 'ACTIVE';

-- 11. Orders / Invoices Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  order_type TEXT CHECK (order_type IN ('subscription_new', 'subscription_renewal', 'add_on_topup')) NOT NULL,
  plan_tier TEXT,
  add_on_package_id TEXT,
  amount_lkr NUMERIC(10, 2) NOT NULL,
  minutes_credited INTEGER NOT NULL,
  payment_gateway TEXT DEFAULT 'mock',
  gateway_payment_id TEXT,
  payhere_payment_id TEXT,
  payhere_subscription_id TEXT,
  md5sig TEXT,
  raw_payload JSONB,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_payhere_sub ON public.orders(payhere_subscription_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roadmap_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read/update own profile" ON public.profiles;
CREATE POLICY "Users read/update own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users access own sessions" ON public.sessions;
CREATE POLICY "Users access own sessions" ON public.sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own session turns" ON public.session_turns;
CREATE POLICY "Users access own session turns" ON public.session_turns
  FOR ALL USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users access own grammar corrections" ON public.grammar_corrections;
CREATE POLICY "Users access own grammar corrections" ON public.grammar_corrections
  FOR ALL USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users read own usage ledger" ON public.usage_ledger;
CREATE POLICY "Users read own usage ledger" ON public.usage_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Everyone can read published roadmap levels" ON public.roadmap_levels;
CREATE POLICY "Everyone can read published roadmap levels" ON public.roadmap_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role has full access to roadmap levels" ON public.roadmap_levels;
CREATE POLICY "Service role has full access to roadmap levels" ON public.roadmap_levels FOR ALL USING (true);

DROP POLICY IF EXISTS "Users access own roadmap progress" ON public.user_roadmap_progress;
CREATE POLICY "Users access own roadmap progress" ON public.user_roadmap_progress FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to user roadmap progress" ON public.user_roadmap_progress;
CREATE POLICY "Service role has full access to user roadmap progress" ON public.user_roadmap_progress FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role access session diagnostics" ON public.session_diagnostics;
CREATE POLICY "Service role access session diagnostics" ON public.session_diagnostics FOR ALL USING (true);

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
