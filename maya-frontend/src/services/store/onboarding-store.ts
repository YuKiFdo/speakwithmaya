import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface UserSessionData {
  id: string;
  phoneNumber: string;
  displayName?: string | null;
  planTier: 'starter' | 'basic' | 'pro' | 'premium';
  planStatus: string;
  monthlyMinutesAllowance: number;
  addOnMinutesBalance?: number;
  minutesBalance: number;
  minutesResetAt?: string;
  level?: string;
  nativeLanguage?: string;
  goal?: string | null;
  challenge?: string | null;
  employmentStatus?: string | null;
  dailyGoalMinutes?: number | null;
  lastActiveStep?: string | null;
  isCompleted?: boolean;
  createdAt?: string;
  telcoProvider?: 'ideamart' | 'mspace' | null;
  telcoStatus?: 'ACTIVE' | 'UNSUBSCRIBED' | null;
  hasTelcoSubscription?: boolean;
  isSubscriptionLocked?: boolean;
  isGracePeriodActive?: boolean;
  gracePeriodEndDate?: string | null;
}

export interface BaselineScores {
  overall: number;
  fluency: number;
  grammar: number;
  pronunciation: number;
}

export interface OnboardingState {
  // Auth Session
  accessToken: string | null;
  user: UserSessionData | null;
  isAuthenticated: boolean;

  // Navigation resume point
  lastActiveRoute: string | null;
  isCompleted: boolean;

  // Hydration flag - true once encrypted storage has been fully decrypted & loaded
  isHydrated: boolean;

  // Onboarding answers
  name: string;
  phone: string;
  goal: string;
  challenge: string;
  level: string;
  employment: string;
  dailyGoalMinutes: number;
  nativeLanguage: 'sinhala' | 'tamil' | 'english';
  baselineScores: BaselineScores | null;
  discountWon: string | null;
}

const STORAGE_KEY = 'maya_onboarding_session_v1';

// Initial state
const defaultState: OnboardingState = {
  accessToken: null,
  user: null,
  isAuthenticated: false,
  lastActiveRoute: null,
  isCompleted: false,
  isHydrated: false,
  name: '',
  phone: '',
  goal: '',
  challenge: '',
  level: 'Intermediate',
  employment: '',
  dailyGoalMinutes: 10,
  nativeLanguage: 'sinhala',
  baselineScores: null,
  discountWon: null,
};

let memoryState: OnboardingState = { ...defaultState };
const listeners = new Set<(state: OnboardingState) => void>();

function notify() {
  for (const listener of listeners) {
    listener(memoryState);
  }
}

import {
  encryptData,
  decryptData,
  CookieStorage,
} from '@/utils/encrypted-storage';

// Hydration tracking - resolves once encrypted storage has been fully loaded
let hydrationResolve: (() => void) | null = null;
const hydrationPromise = new Promise<void>((resolve) => {
  hydrationResolve = resolve;
});

function markHydrated() {
  memoryState = { ...memoryState, isHydrated: true };
  hydrationResolve?.();
  hydrationResolve = null;
  notify();
}

const PRE_AUTH_ROUTES = ['/', '/onboarding/name', '/onboarding/phone', '/onboarding/otp'];
const POST_INTRO_COMPLETION_ROUTES = [
  '/onboarding/call',
  '/onboarding/connecting',
  '/onboarding/building-plan',
  '/onboarding/special-offer',
  '/onboarding/claim-discount',
  '/onboarding/personalized-plan',
  '/onboarding/complete',
  '/(tabs)/dashboard',
];

function isPreAuthRoute(route?: string | null): boolean {
  if (!route) return true;
  if (PRE_AUTH_ROUTES.includes(route)) return true;
  return (
    route.startsWith('/onboarding/name') ||
    route.startsWith('/onboarding/phone') ||
    route.startsWith('/onboarding/otp')
  );
}

function sanitizePersistedState(parsed: any): OnboardingState {
  const cookieToken = CookieStorage.get('maya_auth_token');
  const accessToken = parsed?.accessToken || cookieToken || null;
  const isAuthenticated = Boolean(accessToken);

  // Prefer a valid post-auth route; if lastActiveRoute was polluted with a pre-auth route
  // (e.g. '/onboarding/phone?mode=login'), fall back to user.lastActiveStep
  const rawLastRoute: string | null = !isPreAuthRoute(parsed?.lastActiveRoute)
    ? parsed.lastActiveRoute
    : !isPreAuthRoute(parsed?.user?.lastActiveStep)
    ? parsed.user.lastActiveStep
    : null;

  const reachedPostIntro = Boolean(
    (rawLastRoute && POST_INTRO_COMPLETION_ROUTES.includes(rawLastRoute)) ||
    (parsed?.lastActiveRoute && POST_INTRO_COMPLETION_ROUTES.includes(parsed.lastActiveRoute)) ||
    (parsed?.user?.lastActiveStep && POST_INTRO_COMPLETION_ROUTES.includes(parsed.user.lastActiveStep)) ||
    rawLastRoute === '/onboarding/social-proof',
  );

  // Also heal legacy cached users who already completed all onboarding questions in localStorage
  const hasAnsweredAllOnboardingQuestions = Boolean(
    isAuthenticated && parsed?.goal && parsed?.challenge && parsed?.employment,
  );

  const isCompleted = Boolean(
    parsed?.isCompleted ||
    parsed?.user?.isCompleted ||
    (isAuthenticated && (reachedPostIntro || hasAnsweredAllOnboardingQuestions)),
  );

  let lastActiveRoute: string | null = null;
  if (isCompleted && isAuthenticated) {
    lastActiveRoute = '/(tabs)/dashboard';
  } else if (rawLastRoute && !isPreAuthRoute(rawLastRoute)) {
    lastActiveRoute = rawLastRoute;
  }

  return {
    ...defaultState,
    ...parsed,
    accessToken,
    isAuthenticated,
    isCompleted,
    lastActiveRoute,
    isHydrated: true,
  };
}

let persistVersion = 0;

// Cross-platform persistence adapter with AES-GCM encryption & tamper detection
function loadPersistedState(): OnboardingState {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // If legacy cleartext JSON, parse immediately and queue encrypted migration
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          const state = sanitizePersistedState(parsed);
          // Migrate to encrypted payload in background
          const currentVersion = ++persistVersion;
          const { isHydrated, ...persistable } = state;
          encryptData(JSON.stringify(persistable)).then((enc) => {
            if (currentVersion === persistVersion) {
              window.localStorage.setItem(STORAGE_KEY, enc);
            }
          });
          // Resolve hydration immediately for legacy cleartext
          setTimeout(() => { hydrationResolve?.(); hydrationResolve = null; }, 0);
          return state;
        }

        // Decrypt asynchronously in background and notify listeners
        decryptData(raw)
          .then((decrypted) => {
            if (decrypted) {
              try {
                const parsed = JSON.parse(decrypted);
                const sanitized = sanitizePersistedState(parsed);
                memoryState = sanitized;

                // If legacy cache had polluted lastActiveRoute or unhealed completion state, persist cleaned state immediately
                if (
                  sanitized.lastActiveRoute !== parsed?.lastActiveRoute ||
                  sanitized.isCompleted !== Boolean(parsed?.isCompleted)
                ) {
                  persistState(sanitized);
                }
              } catch {
                memoryState = { ...defaultState, isHydrated: true };
              }
            } else {
              // Tamper detected! Clear corrupted/tampered storage
              console.warn('[OnboardingStore] ⚠️ Purging tampered client storage.');
              window.localStorage.removeItem(STORAGE_KEY);
              CookieStorage.delete('maya_auth_token');
              memoryState = { ...defaultState, isHydrated: true };
            }
            markHydrated();
          })
          .catch((err) => {
            console.warn('[OnboardingStore] Decryption error, proceeding with default state:', err);
            memoryState = { ...defaultState, isHydrated: true };
            markHydrated();
          });

        // Return default (not yet hydrated) state - guard will wait for hydration
        return memoryState;
      }

      // Fallback: if localStorage entry was cleared but auth cookie still exists, recover token
      const fallbackCookieToken = CookieStorage.get('maya_auth_token');
      if (fallbackCookieToken) {
        const recovered: OnboardingState = {
          ...defaultState,
          accessToken: fallbackCookieToken,
          isAuthenticated: true,
          isHydrated: true,
        };
        setTimeout(() => { hydrationResolve?.(); hydrationResolve = null; }, 0);
        return recovered;
      }
    } catch {}
  }

  // No persisted data or not on web - hydrated immediately
  const immediateState = { ...defaultState, isHydrated: true };
  setTimeout(() => { hydrationResolve?.(); hydrationResolve = null; }, 0);
  return immediateState;
}

function persistState(state: OnboardingState) {
  memoryState = state;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const currentVersion = ++persistVersion;
      // Don't persist the isHydrated flag - it's runtime-only
      const { isHydrated, ...persistable } = state;
      const json = JSON.stringify(persistable);
      // Save encrypted envelope into localStorage in strict version order
      encryptData(json).then((encrypted) => {
        if (currentVersion === persistVersion) {
          window.localStorage.setItem(STORAGE_KEY, encrypted);
        }
      });

      // Also sync secure cookie for web
      if (state.accessToken) {
        CookieStorage.set('maya_auth_token', state.accessToken, 30);
      } else {
        CookieStorage.delete('maya_auth_token');
      }
    } catch {}
  }
  notify();
}

// Initialize on file evaluation
memoryState = loadPersistedState();

export const OnboardingStore = {
  getState(): OnboardingState {
    return memoryState;
  },

  /**
   * Returns a promise that resolves once encrypted storage has been fully loaded.
   * Use this to block routing decisions until state is ready.
   */
  waitForHydration(): Promise<void> {
    if (memoryState.isHydrated) {
      return Promise.resolve();
    }
    return Promise.race([
      hydrationPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  },

  subscribe(listener: (state: OnboardingState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Save authenticated session upon phone OTP approval.
   * Ensures the user never has to log in again.
   */
  setAuthSession(token: string, user: UserSessionData) {
    const reachedPostIntro = Boolean(
      user.lastActiveStep && POST_INTRO_COMPLETION_ROUTES.includes(user.lastActiveStep),
    );
    const isCompleted = Boolean(user.isCompleted || memoryState.isCompleted || reachedPostIntro);
    let nextLastActiveRoute = memoryState.lastActiveRoute;
    if (isCompleted) {
      nextLastActiveRoute = '/(tabs)/dashboard';
    } else if (user.lastActiveStep && !isPreAuthRoute(user.lastActiveStep)) {
      nextLastActiveRoute = user.lastActiveStep;
    } else if (isPreAuthRoute(nextLastActiveRoute)) {
      nextLastActiveRoute = '/onboarding/goal';
    }

    const updated: OnboardingState = {
      ...memoryState,
      accessToken: token,
      user: {
        ...user,
        isCompleted,
        lastActiveStep: nextLastActiveRoute,
      },
      isAuthenticated: true,
      phone: user.phoneNumber || memoryState.phone,
      name: user.displayName !== undefined && user.displayName !== null && user.displayName !== '' ? user.displayName : memoryState.name,
      level: user.level || memoryState.level,
      goal: user.goal || memoryState.goal,
      challenge: user.challenge || memoryState.challenge,
      employment: user.employmentStatus || memoryState.employment,
      dailyGoalMinutes: user.dailyGoalMinutes || memoryState.dailyGoalMinutes,
      nativeLanguage: (user.nativeLanguage as any) || memoryState.nativeLanguage,
      isCompleted,
      lastActiveRoute: nextLastActiveRoute,
    };
    persistState(updated);
  },

  /**
   * Updates user's live practice minutes balance (e.g. after call or top-up)
   */
  updateMinutesBalance(newBalance: number) {
    if (!memoryState.user) return;
    const updatedUser = { ...memoryState.user, minutesBalance: newBalance };
    const updated: OnboardingState = { ...memoryState, user: updatedUser };
    persistState(updated);
  },

  /**
   * Remembers the exact route the user reached (e.g. '/onboarding/personalized-plan')
   * so that if they close the browser or app, they resume right back here without restarting.
   */
  setLastActiveRoute(route: string) {
    // Never pollute persistent storage with pre-auth routes (/onboarding/name, /onboarding/phone?mode=login, /onboarding/otp)
    if (isPreAuthRoute(route)) {
      return;
    }

    // Once user reaches the intro call (or any post-call step) or has completed onboarding,
    // mark onboarding completed so closing and reopening skips the intro call straight to dashboard.
    if (memoryState.isCompleted || POST_INTRO_COMPLETION_ROUTES.includes(route)) {
      this.setOnboardingCompleted();
      return;
    }

    const updated: OnboardingState = {
      ...memoryState,
      lastActiveRoute: route,
      user: memoryState.user
        ? {
            ...memoryState.user,
            lastActiveStep: route,
          }
        : null,
    };
    persistState(updated);
  },

  /**
   * Marks onboarding as fully completed when entering Dashboard/Roadmap.
   */
  setOnboardingCompleted() {
    const updated: OnboardingState = {
      ...memoryState,
      isCompleted: true,
      lastActiveRoute: '/(tabs)/dashboard',
      user: memoryState.user
        ? {
            ...memoryState.user,
            isCompleted: true,
            lastActiveStep: '/(tabs)/dashboard',
          }
        : null,
    };
    persistState(updated);
  },

  /**
   * Updates individual onboarding choices.
   */
  updateField<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) {
    const updated: OnboardingState = {
      ...memoryState,
      [key]: value,
    };
    persistState(updated);
  },

  /**
   * Clears state for logout or testing reset.
   */
  clear() {
    // Invalidate any in-flight async encryptData writes so they cannot re-populate localStorage after logout
    ++persistVersion;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem('maya_active_conversation_v1');
        window.localStorage.removeItem('maya_user_stats_cache_v1');
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (
            k &&
            (k.startsWith('maya_active_conversation_v1') ||
              k.startsWith('maya_user_stats_cache_'))
          ) {
            window.localStorage.removeItem(k);
          }
        }
        CookieStorage.delete('maya_auth_token');
      } catch {}
    }
    // Keep isHydrated true - the store is already loaded, this is a runtime clear (logout)
    memoryState = { ...defaultState, isHydrated: true };
    notify();
  },
};

/**
 * Reactive React hook to consume OnboardingStore state.
 */
export function useOnboardingStore(): OnboardingState {
  const [state, setState] = useState<OnboardingState>(OnboardingStore.getState());

  useEffect(() => {
    return OnboardingStore.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
