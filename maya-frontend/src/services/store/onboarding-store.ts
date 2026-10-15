import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface UserSessionData {
  id: string;
  phoneNumber: string;
  displayName?: string | null;
  planTier: 'starter' | 'basic' | 'pro' | 'premium';
  planStatus: string;
  monthlyMinutesAllowance: number;
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

  // Hydration flag — true once encrypted storage has been fully decrypted & loaded
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

// Hydration tracking — resolves once encrypted storage has been fully loaded
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

// Cross-platform persistence adapter with AES-GCM encryption & tamper detection
function loadPersistedState(): OnboardingState {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // If legacy cleartext JSON, parse immediately and queue encrypted migration
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          const state: OnboardingState = {
            ...defaultState,
            ...parsed,
            isAuthenticated: !!parsed.accessToken,
            isHydrated: true,
          };
          // Migrate to encrypted payload in background
          encryptData(JSON.stringify(state)).then((enc) => {
            window.localStorage.setItem(STORAGE_KEY, enc);
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
                memoryState = {
                  ...defaultState,
                  ...parsed,
                  isAuthenticated: !!parsed.accessToken,
                  isHydrated: true,
                };
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

        // Return default (not yet hydrated) state — guard will wait for hydration
        return memoryState;
      }
    } catch {}
  }

  // No persisted data or not on web — hydrated immediately
  const immediateState = { ...defaultState, isHydrated: true };
  setTimeout(() => { hydrationResolve?.(); hydrationResolve = null; }, 0);
  return immediateState;
}

function persistState(state: OnboardingState) {
  memoryState = state;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      // Don't persist the isHydrated flag — it's runtime-only
      const { isHydrated, ...persistable } = state;
      const json = JSON.stringify(persistable);
      // Save encrypted envelope into localStorage
      encryptData(json).then((encrypted) => {
        window.localStorage.setItem(STORAGE_KEY, encrypted);
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
    const updated: OnboardingState = {
      ...memoryState,
      accessToken: token,
      user,
      isAuthenticated: true,
      phone: user.phoneNumber || memoryState.phone,
      name: user.displayName !== undefined && user.displayName !== null && user.displayName !== '' ? user.displayName : memoryState.name,
      level: user.level || memoryState.level,
      goal: user.goal || memoryState.goal,
      challenge: user.challenge || memoryState.challenge,
      employment: user.employmentStatus || memoryState.employment,
      dailyGoalMinutes: user.dailyGoalMinutes || memoryState.dailyGoalMinutes,
      nativeLanguage: (user.nativeLanguage as any) || memoryState.nativeLanguage,
      isCompleted: user.isCompleted ?? memoryState.isCompleted,
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
    // Never overwrite with initial screens if already past phone verification
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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        CookieStorage.delete('maya_auth_token');
      } catch {}
    }
    // Keep isHydrated true — the store is already loaded, this is a runtime clear (logout)
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
