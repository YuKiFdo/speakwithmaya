declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type MayaAnalyticsEventName =
  | 'sign_up'
  | 'onboarding_complete'
  | 'view_plan_selection'
  | 'view_all_plans'
  | 'select_plan'
  | 'begin_checkout'
  | 'continue_starter'
  | 'purchase'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'session_start'
  | 'session_complete';

export interface PlanAnalyticsDetails {
  plan_name: string;
  billing_period: string;
  value: number;
  currency: 'LKR';
}

export interface PurchaseAnalyticsPayload extends PlanAnalyticsDetails {
  transaction_id: string;
  event_id: string;
}

export interface PaymentStatusAnalyticsPayload extends Partial<PlanAnalyticsDetails> {
  transaction_id?: string;
}

const TRACKED_PURCHASES_STORAGE_KEY = 'maya_tracked_purchases_v1';
const TRACKED_SIGNUPS_STORAGE_KEY = 'maya_tracked_signups_v1';
const TRACKED_ONBOARDING_STORAGE_KEY = 'maya_tracked_onboarding_complete_v1';
const PENDING_CHECKOUT_STORAGE_KEY = 'maya_pending_checkout_context_v1';

// Strict PII blocklist per Section 6 (Data Privacy) & Sri Lanka PDPA
const FORBIDDEN_PII_KEYS = new Set([
  'phone',
  'phone_number',
  'phonenumber',
  'name',
  'first_name',
  'last_name',
  'display_name',
  'displayname',
  'otp',
  'code',
  'password',
  'email',
  'card',
  'card_no',
  'card_number',
  'card_masked',
  'card_holder',
  'card_holder_name',
  'card_expiry',
  'cvv',
  'cvc',
  'customer_token',
]);

const memoryTrackedPurchases = new Set<string>();
const memoryTrackedSignups = new Set<string>();
const memoryTrackedOnboarding = new Set<string>();
const memoryTrackedSessionsStarted = new Set<string>();
const memoryTrackedSessionsCompleted = new Set<string>();

function isWebBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readTrackedSet(storageKey: string, memoryFallback: Set<string>): Set<string> {
  const combined = new Set<string>(memoryFallback);
  if (!isWebBrowser()) return combined;
  try {
    const raw = window.localStorage?.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (typeof item === 'string' && item) combined.add(item);
        });
      }
    }
  } catch {
    // Ignore storage read errors in restricted browsing modes
  }
  return combined;
}

function addToTrackedSet(storageKey: string, memoryFallback: Set<string>, id: string): void {
  if (!id) return;
  memoryFallback.add(id);
  if (!isWebBrowser()) return;
  try {
    const current = readTrackedSet(storageKey, memoryFallback);
    current.add(id);
    // Cap stored history to most recent 200 IDs
    const serialized = JSON.stringify(Array.from(current).slice(-200));
    window.localStorage?.setItem(storageKey, serialized);
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Strips any forbidden PII fields and undefined values before pushing to window.dataLayer.
 */
export function sanitizeDataLayerPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (val === undefined || val === null) continue;
    if (FORBIDDEN_PII_KEYS.has(key.toLowerCase())) continue;
    clean[key] = val;
  }
  return clean;
}

/**
 * Safely initializes `window.dataLayer` and pushes a privacy-scrubbed event on Web.
 */
export function pushDataLayerEvent(
  event: MayaAnalyticsEventName,
  params: Record<string, unknown> = {}
): void {
  if (!isWebBrowser()) return;

  window.dataLayer = window.dataLayer || [];
  const sanitized = sanitizeDataLayerPayload({
    event,
    ...params,
  });

  window.dataLayer.push(sanitized);
}

/**
 * Parses a price string like "LKR 8,640" or "Billed as LKR 8,640 for 3 months" or numeric value into a number.
 */
export function parseLkrAmount(raw: string | number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return 0;
  }
  // Extract LKR amount (prefer "Billed as LKR X,XXX" if present, otherwise first number)
  const billedMatch = raw.match(/Billed\s+as\s+LKR\s*([\d,]+(?:\.\d+)?)/i);
  const target = billedMatch ? billedMatch[1] : raw;
  const numMatch = target.match(/([\d,]+(?:\.\d+)?)/);
  if (!numMatch) return 0;
  const parsed = parseFloat(numMatch[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Resolves actual `plan_name`, `billing_period`, `value`, and `currency` dynamically
 * from plan definitions, checkout parameters, or server-verified order metadata.
 */
export function resolvePlanAnalyticsDetails(input: {
  planId?: string | null;
  planName?: string | null;
  billingPeriod?: string | null;
  amount?: string | number | null;
  billedInfo?: string | null;
  priceText?: string | null;
}): PlanAnalyticsDetails {
  const rawId = String(input.planId || '').toLowerCase().trim();
  const rawName = String(input.planName || '').trim();

  let plan_name = 'Pro';
  let billing_period = 'monthly';
  let fallbackValue = 5400;

  if (
    rawId === '3-months-pro' ||
    rawId.includes('3-months-pro') ||
    rawName.toLowerCase().includes('3 months pro') ||
    input.billingPeriod === '3_months' ||
    input.billingPeriod === '3-months'
  ) {
    plan_name = 'Pro';
    billing_period = '3_months';
    fallbackValue = 8640;
  } else if (rawId === 'basic' || rawId.includes('basic') || rawName.toLowerCase() === 'basic') {
    plan_name = 'Basic';
    billing_period = 'monthly';
    fallbackValue = 3600;
  } else if (rawId === 'premium' || rawId.includes('premium') || rawName.toLowerCase() === 'premium') {
    plan_name = 'Premium';
    billing_period = 'monthly';
    fallbackValue = 7200;
  } else if (rawId === 'pro' || rawId.includes('pro') || rawName.toLowerCase() === 'pro') {
    plan_name = 'Pro';
    billing_period = 'monthly';
    fallbackValue = 5400;
  } else if (rawId === '30-min' || rawId.includes('30-min')) {
    plan_name = 'Extra_30m';
    billing_period = 'one_time';
    fallbackValue = 300;
  } else if (rawId === '120-min' || rawId.includes('120-min')) {
    plan_name = 'Extra_120m';
    billing_period = 'one_time';
    fallbackValue = 900;
  } else if (rawId === '300-min' || rawId.includes('300-min')) {
    plan_name = 'Extra_300m';
    billing_period = 'one_time';
    fallbackValue = 2000;
  } else if (rawName) {
    plan_name = rawName;
    if (input.billingPeriod) {
      billing_period = input.billingPeriod;
    }
  }

  if (input.billingPeriod) {
    const cleanCycle = input.billingPeriod.toLowerCase();
    if (cleanCycle === '3_months' || cleanCycle === '3-months' || cleanCycle.includes('3')) {
      billing_period = '3_months';
    } else if (cleanCycle === 'monthly' || cleanCycle.includes('1 month')) {
      billing_period = 'monthly';
    } else if (cleanCycle === 'one_time') {
      billing_period = 'one_time';
    }
  }

  const resolvedAmount =
    parseLkrAmount(input.amount) ||
    parseLkrAmount(input.billedInfo) ||
    parseLkrAmount(input.priceText) ||
    fallbackValue;

  return {
    plan_name,
    billing_period,
    value: resolvedAmount,
    currency: 'LKR',
  };
}

/**
 * Persists pending checkout context in sessionStorage before PayHere redirect
 * so `payment_cancelled` and `payment_failed` have accurate plan & order context upon return.
 */
export function savePendingCheckoutContext(
  context: PlanAnalyticsDetails & { transaction_id?: string }
): void {
  if (!isWebBrowser()) return;
  try {
    window.sessionStorage?.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        ...context,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore sessionStorage errors
  }
}

export function getPendingCheckoutContext():
  | (PlanAnalyticsDetails & { transaction_id?: string })
  | null {
  if (!isWebBrowser()) return null;
  try {
    const raw = window.sessionStorage?.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      plan_name: String(parsed.plan_name || 'Pro'),
      billing_period: String(parsed.billing_period || 'monthly'),
      value: Number(parsed.value || 0),
      currency: 'LKR',
      ...(parsed.transaction_id ? { transaction_id: String(parsed.transaction_id) } : {}),
    };
  } catch {
    return null;
  }
}

export function clearPendingCheckoutContext(): void {
  if (!isWebBrowser()) return;
  try {
    window.sessionStorage?.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage errors
  }
}

export function hasPurchaseBeenTracked(transactionId: string): boolean {
  if (!transactionId) return false;
  const tracked = readTrackedSet(TRACKED_PURCHASES_STORAGE_KEY, memoryTrackedPurchases);
  return tracked.has(transactionId);
}

export function markPurchaseTracked(transactionId: string): void {
  if (!transactionId) return;
  addToTrackedSet(TRACKED_PURCHASES_STORAGE_KEY, memoryTrackedPurchases, transactionId);
}

// ─── Typed Event Emitters (Section 2 & 3 Specification) ──────────────────────

/**
 * 1. User successfully completes registration and OTP verification (`sign_up`)
 */
export function trackSignUp(options?: { userId?: string; method?: string }): void {
  const dedupKey = options?.userId || 'latest_signup';
  if (options?.userId) {
    const tracked = readTrackedSet(TRACKED_SIGNUPS_STORAGE_KEY, memoryTrackedSignups);
    if (tracked.has(dedupKey)) return;
    addToTrackedSet(TRACKED_SIGNUPS_STORAGE_KEY, memoryTrackedSignups, dedupKey);
  }
  pushDataLayerEvent('sign_up', {
    method: options?.method || 'phone_otp',
  });
}

/**
 * 2. User completes onboarding (`onboarding_complete`)
 */
export function trackOnboardingComplete(userId?: string): void {
  const dedupKey = userId || 'current_user';
  const tracked = readTrackedSet(TRACKED_ONBOARDING_STORAGE_KEY, memoryTrackedOnboarding);
  if (tracked.has(dedupKey)) return;
  addToTrackedSet(TRACKED_ONBOARDING_STORAGE_KEY, memoryTrackedOnboarding, dedupKey);

  pushDataLayerEvent('onboarding_complete');
}

/**
 * 3. User views the plan selection screen (`view_plan_selection`)
 */
export function trackViewPlanSelection(): void {
  pushDataLayerEvent('view_plan_selection');
}

/**
 * 4. User expands and views all available plans (`view_all_plans`)
 */
export function trackViewAllPlans(): void {
  pushDataLayerEvent('view_all_plans');
}

/**
 * 5. User selects a subscription plan (`select_plan`)
 */
export function trackSelectPlan(plan: PlanAnalyticsDetails): void {
  pushDataLayerEvent('select_plan', {
    plan_name: plan.plan_name,
    billing_period: plan.billing_period,
    value: plan.value,
    currency: 'LKR',
  });
}

/**
 * 6. User proceeds to PayHere checkout (`begin_checkout`)
 */
export function trackBeginCheckout(
  plan: PlanAnalyticsDetails & { transaction_id?: string }
): void {
  savePendingCheckoutContext(plan);
  pushDataLayerEvent('begin_checkout', {
    plan_name: plan.plan_name,
    billing_period: plan.billing_period,
    value: plan.value,
    currency: 'LKR',
  });
}

/**
 * 7. User chooses to continue with the Starter plan (`continue_starter`)
 */
export function trackContinueStarter(): void {
  pushDataLayerEvent('continue_starter');
}

/**
 * 8. Payment is successfully verified server-side (`purchase`)
 * Enforces strict deduplication by `transaction_id`.
 */
export function trackVerifiedPurchase(payload: PurchaseAnalyticsPayload): boolean {
  const txId = String(payload.transaction_id || '').trim();
  if (!txId) return false;

  if (hasPurchaseBeenTracked(txId)) {
    return false;
  }

  markPurchaseTracked(txId);
  clearPendingCheckoutContext();

  pushDataLayerEvent('purchase', {
    transaction_id: txId,
    event_id: payload.event_id || `purchase_${txId}`,
    plan_name: payload.plan_name,
    billing_period: payload.billing_period,
    value: Number(payload.value),
    currency: 'LKR',
  });

  return true;
}

/**
 * 9. Confirmed payment failure (`payment_failed`)
 */
export function trackPaymentFailed(payload?: PaymentStatusAnalyticsPayload): void {
  const pending = getPendingCheckoutContext();
  const planName = payload?.plan_name || pending?.plan_name;
  const billingPeriod = payload?.billing_period || pending?.billing_period;
  const value = payload?.value ?? pending?.value;
  const transactionId = payload?.transaction_id || pending?.transaction_id;

  clearPendingCheckoutContext();

  pushDataLayerEvent('payment_failed', {
    ...(planName ? { plan_name: planName } : {}),
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
    ...(typeof value === 'number' && value > 0 ? { value, currency: 'LKR' } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

/**
 * 10. Confirmed checkout cancellation / abandonment (`payment_cancelled`)
 */
export function trackPaymentCancelled(payload?: PaymentStatusAnalyticsPayload): void {
  const pending = getPendingCheckoutContext();
  const planName = payload?.plan_name || pending?.plan_name;
  const billingPeriod = payload?.billing_period || pending?.billing_period;
  const value = payload?.value ?? pending?.value;
  const transactionId = payload?.transaction_id || pending?.transaction_id;

  clearPendingCheckoutContext();

  pushDataLayerEvent('payment_cancelled', {
    ...(planName ? { plan_name: planName } : {}),
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
    ...(typeof value === 'number' && value > 0 ? { value, currency: 'LKR' } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

/**
 * 11. User starts an AI practice session (`session_start`)
 */
export function trackSessionStart(sessionId?: string): void {
  if (sessionId) {
    if (memoryTrackedSessionsStarted.has(sessionId)) return;
    memoryTrackedSessionsStarted.add(sessionId);
  }
  pushDataLayerEvent('session_start');
}

/**
 * 12. User completes an AI practice session (`session_complete`)
 */
export function trackSessionComplete(durationSeconds: number, sessionId?: string): void {
  if (sessionId) {
    if (memoryTrackedSessionsCompleted.has(sessionId)) return;
    memoryTrackedSessionsCompleted.add(sessionId);
  }
  const safeDuration = Math.max(0, Math.round(Number(durationSeconds) || 0));
  pushDataLayerEvent('session_complete', {
    session_duration: safeDuration,
  });
}
