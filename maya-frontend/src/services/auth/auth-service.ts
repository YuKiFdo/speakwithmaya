import { Platform } from 'react-native';
import { OnboardingStore } from '../store/onboarding-store';

export interface SendOtpResponse {
  success: boolean;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  message?: string;
  isTestAccount?: boolean;
  accessToken?: string;
  user?: any;
  lastActiveRoute?: string;
  isCompleted?: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  accessToken: string;
  isNewUser: boolean;
  isCompleted?: boolean;
  lastActiveRoute?: string;
  user: {
    id: string;
    phoneNumber: string;
    displayName: string | null;
    planTier: 'starter' | 'basic' | 'pro' | 'premium';
    planStatus: string;
    monthlyMinutesAllowance: number;
    addOnMinutesBalance?: number;
    minutesBalance: number;
    minutesResetAt?: string;
    level?: string;
    nativeLanguage?: string;
    lastActiveStep?: string | null;
    isCompleted?: boolean;
  };
}

export interface PreferencesPayload {
  displayName?: string;
  nativeLanguage?: string;
  level?: string;
  goal?: string;
  challenge?: string;
  employmentStatus?: string;
  dailyGoalMinutes?: number;
  baselineScores?: {
    overall?: number;
    fluency?: number;
    grammar?: number;
    pronunciation?: number;
  };
}

const getBackendUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3000';
    }
    if (hostname.endsWith('speakwithmaya.com')) {
      return 'https://api.speakwithmaya.com';
    }
    if (
      hostname.includes('azurecontainerapps.io') ||
      hostname.includes('azurewebsites.net') ||
      hostname.includes('southeastasia')
    ) {
      return 'https://maya-backend.icyisland-5baf2c26.southeastasia.azurecontainerapps.io';
    }
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000';
};

class AuthService {
  private baseUrl = getBackendUrl();

  /**
   * Request OTP code to be sent to mobile number.
   */
  async sendOtp(phoneNumber: string): Promise<SendOtpResponse> {
    const res = await fetch(`${this.baseUrl}/v1/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send verification code');
    }

    // If test account was authenticated directly without OTP, set the session immediately
    if (data.isTestAccount && data.accessToken && data.user) {
      OnboardingStore.setAuthSession(data.accessToken, data.user);
      if (data.lastActiveRoute) {
        OnboardingStore.setLastActiveRoute(data.lastActiveRoute);
      }
      OnboardingStore.setOnboardingCompleted();
    }

    return data;
  }

  /**
   * Verify OTP and receive auth token with Starter Plan (10 min).
   * Persists database session so user never has to log in again.
   */
  async verifyOtp(phoneNumber: string, code: string): Promise<VerifyOtpResponse> {
    const res = await fetch(`${this.baseUrl}/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid verification code');
    }

    // Persist real auth session from database
    if (data.accessToken && data.user) {
      OnboardingStore.setAuthSession(data.accessToken, data.user);
      if (data.lastActiveRoute) {
        OnboardingStore.setLastActiveRoute(data.lastActiveRoute);
      }
      if (data.isCompleted) {
        OnboardingStore.setOnboardingCompleted();
      }
    }

    return data;
  }

  /**
   * Persist onboarding answers to user's profile.
   */
  async savePreferences(payload: PreferencesPayload): Promise<boolean> {
    const token = OnboardingStore.getState().accessToken;
    try {
      const res = await fetch(`${this.baseUrl}/v1/users/onboarding-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'dev-token'}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Immediately sync database updates to store and encrypted storage/cookie
        await this.fetchUserProfile();
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Syncs the current onboarding step to the backend so logging in from another device resumes seamlessly.
   */
  async syncStep(step: string) {
    OnboardingStore.setLastActiveRoute(step);
    const token = OnboardingStore.getState().accessToken;
    if (!token) return;
    try {
      await fetch(`${this.baseUrl}/v1/users/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step }),
      });
    } catch {}
  }

  /**
   * Refreshes user profile & minutes quota from backend.
   */
  async fetchUserProfile() {
    const token = OnboardingStore.getState().accessToken;
    if (!token) return null;

    try {
      const res = await fetch(`${this.baseUrl}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const user = {
            id: data.profile.id,
            phoneNumber: data.profile.phone_number,
            displayName: data.profile.display_name,
            planTier: data.profile.plan_tier,
            planStatus: data.profile.plan_status,
            monthlyMinutesAllowance: data.profile.monthly_minutes_allowance,
            addOnMinutesBalance: data.profile.add_on_minutes_balance ?? 0,
            minutesBalance: data.profile.minutes_balance,
            minutesResetAt: data.profile.minutes_reset_at,
            level: data.profile.level,
            nativeLanguage: data.profile.native_language,
            goal: data.profile.goal,
            challenge: data.profile.challenge,
            employmentStatus: data.profile.employment_status,
            dailyGoalMinutes: data.profile.daily_goal_minutes,
            lastActiveStep: data.profile.last_active_step,
            createdAt: data.profile.created_at,
            isCompleted: Boolean(data.profile.onboarding_completed_at),
          };
          OnboardingStore.setAuthSession(token, user);
          return user;
        }
      } else if (res.status === 401 || res.status === 404) {
        // Account was deleted in backend/database or token revoked
        console.warn('[authService] Account was deleted or session invalidated. Resetting local session.');
        OnboardingStore.clear();
        return null;
      }
    } catch {}
    return OnboardingStore.getState().user;
  }
}

export const authService = new AuthService();
