declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type MayaAnalyticsEventName =
  // | 'complete_registration'
  // | 'initiate_checkout'
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
  | 'session_complete'
  | 'user_data_update';

/**
 * Standard Customer Information required for GTM, Stape Server-Side GTM, GA4, Meta Pixel & CAPI.
 * Conforms to Google Ads Enhanced Conversions (phone_number + address.first_name)
 * and Meta Pixel/CAPI (external_id, phone, first_name).
 */
export interface TrackingUserData {
  user_id: string;
  external_id: string;
  first_name: string;
  email: string;
  phone: string;
  phone_number: string;
  address: {
    first_name: string;
  };
}

export interface PlanAnalyticsDetails {
  plan_name: string;
  billing_period: string;
  value: number;
  currency: 'LKR';
}

export interface PurchaseAnalyticsPayload extends PlanAnalyticsDetails {
  transaction_id: string;
  event_id?: string;
  user_data?: TrackingUserData;
}

export interface PaymentStatusAnalyticsPayload extends Partial<PlanAnalyticsDetails> {
  transaction_id?: string;
  user_data?: TrackingUserData;
}

const TRACKED_PURCHASES_STORAGE_KEY = 'maya_tracked_purchases_v1';
const TRACKED_SIGNUPS_STORAGE_KEY = 'maya_tracked_signups_v1';
const TRACKED_ONBOARDING_STORAGE_KEY = 'maya_tracked_onboarding_complete_v1';
const PENDING_CHECKOUT_STORAGE_KEY = 'maya_pending_checkout_context_v1';
const TRACKING_USER_DATA_KEY = 'maya_tracking_user_data_v1';

// Strict credential blocklist: never allow raw financial/security credentials into dataLayer
const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'otp',
  'code',
  'password',
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

let memoryTrackingUserData: TrackingUserData = {
  user_id: '',
  external_id: '',
  first_name: '',
  email: '',
  phone: '',
  phone_number: '',
  address: {
    first_name: '',
  },
};

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
 * Formats phone numbers strictly to E.164 international standard with leading '+'
 * (e.g. +94771234567) as required by Google Ads Enhanced Conversions and Meta CAPI.
 */
export function formatTrackingPhone(phone?: string | null): string {
  if (!phone) return '';
  const clean = String(phone).trim();
  const digits = clean.replace(/\D/g, '');
  if (!digits) return '';

  let e164 = digits;
  // Sri Lankan local format starting with 0 (e.g. 0771234567) -> 94771234567
  if (digits.length === 10 && digits.startsWith('0')) {
    e164 = `94${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith('7')) {
    // Sri Lankan 9-digit format (e.g. 771234567) -> 94771234567
    e164 = `94${digits}`;
  }
  return `+${e164}`;
}

export function extractFirstName(name?: string | null): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
}

export function formatTrackingEmail(email?: string | null): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Generates an event ID for CAPI / Stape tag deduplication.
 */
export function generateEventId(prefix: string, seed?: string): string {
  const cleanSeed = (seed || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const rand = Math.random().toString(36).substring(2, 8);
  const timestamp = Date.now();
  return cleanSeed ? `${prefix}_${cleanSeed}_${timestamp}` : `${prefix}_${timestamp}_${rand}`;
}

/**
 * Builds user data payload providing both root-level variables and nested user_data
 * for maximum compatibility with GTM Data Layer Variables, Google Enhanced Conversions, and Meta CAPI.
 */
export function buildUserDataPayload(userData: TrackingUserData): Record<string, unknown> {
  const hasUser = Boolean(userData.user_id || userData.email || userData.phone_number);
  if (!hasUser) return {};

  return {
    user_id: userData.user_id,
    external_id: userData.external_id || userData.user_id,
    first_name: userData.first_name,
    email: userData.email,
    phone: userData.phone,
    phone_number: userData.phone_number,
    address: {
      first_name: userData.first_name,
    },
    user_data: {
      user_id: userData.user_id,
      external_id: userData.external_id || userData.user_id,
      first_name: userData.first_name,
      email: userData.email,
      phone: userData.phone,
      phone_number: userData.phone_number,
      address: {
        first_name: userData.first_name,
      },
    },
  };
}

export function saveTrackingUserData(
  data: Partial<TrackingUserData> & { phoneNumber?: string; userId?: string; firstName?: string }
): TrackingUserData {
  const current = getTrackingUserData();
  const rawUserId = data.user_id !== undefined && data.user_id !== null ? data.user_id : (data.userId || current.user_id || '');
  const rawFirstName = data.first_name !== undefined && data.first_name !== null ? data.first_name : (data.firstName || data.address?.first_name || current.first_name);
  const rawEmail = data.email !== undefined && data.email !== null ? data.email : current.email;
  const rawPhone = data.phone_number !== undefined && data.phone_number !== null ? data.phone_number : (data.phone !== undefined && data.phone !== null ? data.phone : (data.phoneNumber || current.phone_number));

  const formattedPhone = formatTrackingPhone(rawPhone);
  const firstNameClean = extractFirstName(rawFirstName);
  const emailClean = formatTrackingEmail(rawEmail);
  const userIdClean = String(rawUserId).trim();

  const updated: TrackingUserData = {
    user_id: userIdClean,
    external_id: userIdClean,
    first_name: firstNameClean,
    email: emailClean,
    phone: formattedPhone,
    phone_number: formattedPhone,
    address: {
      first_name: firstNameClean,
    },
  };

  memoryTrackingUserData = updated;

  if (isWebBrowser()) {
    try {
      window.localStorage?.setItem(TRACKING_USER_DATA_KEY, JSON.stringify(updated));
    } catch {}

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'user_data_update',
      ...buildUserDataPayload(updated),
    });
  }

  return updated;
}

export function getTrackingUserData(
  fallback?: Partial<TrackingUserData> & { phoneNumber?: string; userId?: string; firstName?: string }
): TrackingUserData {
  let stored: Partial<TrackingUserData> & { phoneNumber?: string } = {};
  if (isWebBrowser()) {
    try {
      const raw = window.localStorage?.getItem(TRACKING_USER_DATA_KEY);
      if (raw) {
        stored = JSON.parse(raw) || {};
      }
    } catch {}
  }

  const rawUserId = fallback?.user_id || fallback?.userId || stored.user_id || memoryTrackingUserData.user_id || '';
  const rawFirstName = fallback?.first_name || fallback?.firstName || fallback?.address?.first_name || stored.first_name || stored.address?.first_name || memoryTrackingUserData.first_name;
  const rawEmail = fallback?.email || stored.email || memoryTrackingUserData.email;
  const rawPhone = fallback?.phone_number || fallback?.phone || fallback?.phoneNumber || stored.phone_number || stored.phone || stored.phoneNumber || memoryTrackingUserData.phone_number;

  const formattedPhone = formatTrackingPhone(rawPhone);
  const firstNameClean = extractFirstName(rawFirstName);
  const emailClean = formatTrackingEmail(rawEmail);
  const userIdClean = String(rawUserId).trim();

  return {
    user_id: userIdClean,
    external_id: userIdClean,
    first_name: firstNameClean,
    email: emailClean,
    phone: formattedPhone,
    phone_number: formattedPhone,
    address: {
      first_name: firstNameClean,
    },
  };
}


export function sanitizeDataLayerPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (val === undefined || val === null) continue;
    if (FORBIDDEN_CREDENTIAL_KEYS.has(key.toLowerCase())) continue;
    clean[key] = val;
  }
  return clean;
}


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


export function parseLkrAmount(raw: string | number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return 0;
  }
  const billedMatch = raw.match(/Billed\s+as\s+LKR\s*([\d,]+(?:\.\d+)?)/i);
  const target = billedMatch ? billedMatch[1] : raw;
  const numMatch = target.match(/([\d,]+(?:\.\d+)?)/);
  if (!numMatch) return 0;
  const parsed = parseFloat(numMatch[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}


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


export function trackCompleteRegistration(data?: {
  userId?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
}): void {
  const userData = saveTrackingUserData({
    user_id: data?.userId,
    first_name: data?.firstName,
    email: data?.email,
    phone_number: data?.phone_number || data?.phone,
  });

  const dedupKey = userData.user_id || `signup_${userData.phone_number || 'anonymous'}`;
  if (dedupKey) {
    const tracked = readTrackedSet(TRACKED_SIGNUPS_STORAGE_KEY, memoryTrackedSignups);
    if (tracked.has(dedupKey)) return;
    addToTrackedSet(TRACKED_SIGNUPS_STORAGE_KEY, memoryTrackedSignups, dedupKey);
  }

  if (!isWebBrowser()) return;
  const eventId = generateEventId('signup', userData.user_id);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'sign_up',
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}


export function trackSignUp(options?: {
  userId?: string;
  method?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
}): void {
  trackCompleteRegistration({
    userId: options?.userId,
    firstName: options?.firstName,
    email: options?.email,
    phone_number: options?.phone_number || options?.phone,
  });
}


export function trackOnboardingComplete(userId?: string): void {
  const dedupKey = userId || 'current_user';
  const tracked = readTrackedSet(TRACKED_ONBOARDING_STORAGE_KEY, memoryTrackedOnboarding);
  if (tracked.has(dedupKey)) return;
  addToTrackedSet(TRACKED_ONBOARDING_STORAGE_KEY, memoryTrackedOnboarding, dedupKey);

  const userData = getTrackingUserData(userId ? { user_id: userId } : undefined);
  const eventId = generateEventId('onboarding', userId);

  pushDataLayerEvent('onboarding_complete', {
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}


export function trackViewPlanSelection(): void {
  const userData = getTrackingUserData();
  const eventId = generateEventId('view_plans');
  pushDataLayerEvent('view_plan_selection', {
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}


export function trackViewAllPlans(): void {
  const userData = getTrackingUserData();
  const eventId = generateEventId('view_all_plans');
  pushDataLayerEvent('view_all_plans', {
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}


export function trackSelectPlan(plan: PlanAnalyticsDetails): void {
  const userData = getTrackingUserData();
  const eventId = generateEventId('select', plan.plan_name);
  pushDataLayerEvent('select_plan', {
    plan_name: plan.plan_name,
    content_name: plan.plan_name,
    content_type: 'product',
    billing_period: plan.billing_period,
    value: plan.value,
    currency: 'LKR',
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}


export function trackInitiateCheckout(
  plan?: (PlanAnalyticsDetails & { transaction_id?: string }) | null,
  userDataOverride?: Partial<TrackingUserData>
): void {
  if (plan) {
    savePendingCheckoutContext(plan);
  }

  const userData = getTrackingUserData(userDataOverride);

  if (!isWebBrowser()) return;
  const eventId = generateEventId('checkout', plan?.transaction_id || plan?.plan_name);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'begin_checkout',
    event_id: eventId,
    ...(plan?.plan_name ? { plan_name: plan.plan_name, content_name: plan.plan_name, content_type: 'product' } : {}),
    ...(typeof plan?.value === 'number' ? { value: plan.value, currency: 'LKR' } : {}),
    ...(plan?.billing_period ? { billing_period: plan.billing_period } : {}),
    ...(plan?.transaction_id ? { transaction_id: plan.transaction_id } : {}),
    ...buildUserDataPayload(userData),
  });
}


export function trackBeginCheckout(
  plan: PlanAnalyticsDetails & { transaction_id?: string },
  userDataOverride?: Partial<TrackingUserData>
): void {
  trackInitiateCheckout(plan, userDataOverride);
}

/**
 * 7. User chooses to continue with the Starter plan (`continue_starter`)
 */
export function trackContinueStarter(): void {
  const userData = getTrackingUserData();
  const eventId = generateEventId('starter');
  pushDataLayerEvent('continue_starter', {
    event_id: eventId,
    ...buildUserDataPayload(userData),
  });
}

/**
 * 8. Successful Purchase (Requirement 4)
 * Triggered ONLY when payment is successfully confirmed and verified server-side.
 * Strictly prevents duplicate purchase events using the unique transaction ID.
 */
export function trackVerifiedPurchase(
  payload: PurchaseAnalyticsPayload,
  userDataOverride?: Partial<TrackingUserData>
): boolean {
  const txId = String(payload.transaction_id || '').trim();
  if (!txId) return false;

  // Strict deduplication: never fire duplicate purchase for same transaction_id
  if (hasPurchaseBeenTracked(txId)) {
    return false;
  }

  markPurchaseTracked(txId);
  clearPendingCheckoutContext();

  const userData = getTrackingUserData(userDataOverride || payload.user_data);

  if (!isWebBrowser()) return true;
  const eventId = payload.event_id || generateEventId('purchase', txId);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'purchase',
    transaction_id: txId,
    value: Number(payload.value),
    currency: 'LKR',
    plan_name: payload.plan_name,
    content_name: payload.plan_name,
    content_type: 'product',
    ...(payload.billing_period ? { billing_period: payload.billing_period } : {}),
    event_id: eventId,
    ...buildUserDataPayload(userData),
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
  const userData = getTrackingUserData(payload?.user_data);
  const eventId = generateEventId('fail', transactionId || planName);

  clearPendingCheckoutContext();

  pushDataLayerEvent('payment_failed', {
    event_id: eventId,
    ...(planName ? { plan_name: planName, content_name: planName } : {}),
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
    ...(typeof value === 'number' && value > 0 ? { value, currency: 'LKR' } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
    ...buildUserDataPayload(userData),
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
  const userData = getTrackingUserData(payload?.user_data);
  const eventId = generateEventId('cancel', transactionId || planName);

  clearPendingCheckoutContext();

  pushDataLayerEvent('payment_cancelled', {
    event_id: eventId,
    ...(planName ? { plan_name: planName, content_name: planName } : {}),
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
    ...(typeof value === 'number' && value > 0 ? { value, currency: 'LKR' } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
    ...buildUserDataPayload(userData),
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
  const userData = getTrackingUserData();
  const eventId = generateEventId('session_start', sessionId);
  pushDataLayerEvent('session_start', {
    event_id: eventId,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...buildUserDataPayload(userData),
  });
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
  const userData = getTrackingUserData();
  const eventId = generateEventId('session_complete', sessionId);
  pushDataLayerEvent('session_complete', {
    event_id: eventId,
    ...(sessionId ? { session_id: sessionId } : {}),
    session_duration: safeDuration,
    ...buildUserDataPayload(userData),
  });
}
