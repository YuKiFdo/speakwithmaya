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

// Cross-platform persistence adapter with AES-GCM encryption & tamper detection
function loadPersistedState(): OnboardingState {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // If legacy cleartext JSON, parse immediately and queue encrypted migration
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          const state = {
            ...defaultState,
            ...parsed,
            isAuthenticated: !!parsed.accessToken,
          };
          // Migrate to encrypted payload in background
          encryptData(JSON.stringify(state)).then((enc) => {
            window.localStorage.setItem(STORAGE_KEY, enc);
          });
          return state;
        }

        // Decrypt asynchronously in background and notify listeners
        decryptData(raw).then((decrypted) => {
          if (decrypted) {
            try {
              const parsed = JSON.parse(decrypted);
              memoryState = {
                ...defaultState,
                ...parsed,
                isAuthenticated: !!parsed.accessToken,
              };
              notify();
            } catch {}
          } else {
            // Tamper detected! Clear corrupted/tampered storage
            console.warn('[OnboardingStore] ⚠️ Purging tampered client storage.');
            window.localStorage.removeItem(STORAGE_KEY);
            CookieStorage.delete('maya_auth_token');
            memoryState = { ...defaultState };
            notify();
          }
        });
      }
    } catch {}
  }
  return memoryState;
}

function persistState(state: OnboardingState) {
  memoryState = state;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const json = JSON.stringify(state);
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
      name: user.displayName || memoryState.name,
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
    memoryState = { ...defaultState };
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
