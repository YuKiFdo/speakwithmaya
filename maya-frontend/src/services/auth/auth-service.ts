import { Platform } from 'react-native';
import { OnboardingStore } from '../store/onboarding-store';

export interface SendOtpResponse {
  success: boolean;
  alreadyRegistered?: boolean;
  notRegistered?: boolean;
  phoneNumber?: string;
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
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string | null;
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
  async sendOtp(
    phoneNumber: string,
    options?: { isLoginMode?: boolean },
  ): Promise<SendOtpResponse> {
    const res = await fetch(`${this.baseUrl}/v1/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        isLoginMode: Boolean(options?.isLoginMode),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send verification code');
    }

    if (data.alreadyRegistered || data.notRegistered) {
      return data;
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
  async verifyOtp(
    phoneNumber: string,
    code: string,
    options?: { isLoginMode?: boolean },
  ): Promise<VerifyOtpResponse> {
    const currentState = OnboardingStore.getState();
    const res = await fetch(`${this.baseUrl}/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        code,
        displayName: currentState.name ? currentState.name.trim() : undefined,
        isLoginMode: options?.isLoginMode,
      }),
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
      if (data.isCompleted || options?.isLoginMode) {
        OnboardingStore.setOnboardingCompleted();
      }
    }

    return data;
  }

  /**
   * Persist onboarding answers to user's profile.
   */
  async savePreferences(payload: PreferencesPayload): Promise<boolean> {
    const state = OnboardingStore.getState();
    const token = state.accessToken;
    const userId = state.user?.id;

    // Immediately update local store and per-user profile extra cache (avatarUrl & email)
    if (payload.displayName !== undefined) {
      OnboardingStore.updateField('name', payload.displayName);
    }
    if (payload.phoneNumber !== undefined) {
      OnboardingStore.updateField('phone', payload.phoneNumber);
    }
    if (payload.email !== undefined) {
      OnboardingStore.updateField('email', payload.email);
    }
    if (payload.avatarUrl !== undefined) {
      OnboardingStore.updateField('avatarUrl', payload.avatarUrl);
    }
    if (payload.level !== undefined) {
      OnboardingStore.updateField('level', payload.level);
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && userId) {
      try {
        const extraKey = `maya_user_profile_extra_${userId}`;
        const existingRaw = window.localStorage.getItem(extraKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = {
          ...existing,
          ...(payload.email !== undefined ? { email: payload.email } : {}),
          ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
        };
        window.localStorage.setItem(extraKey, JSON.stringify(merged));
      } catch {}
    }

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
   * Syncs the current onboarding step and accumulated preferences to the backend
   * so refreshing or logging in from another device resumes seamlessly.
   */
  async syncStep(step: string) {
    OnboardingStore.setLastActiveRoute(step);
    const state = OnboardingStore.getState();
    const token = state.accessToken;
    if (!token) return;
    try {
      await fetch(`${this.baseUrl}/v1/users/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          step,
          displayName: state.name ? state.name.trim() : undefined,
          nativeLanguage: state.nativeLanguage || undefined,
          level: state.level || undefined,
          goal: state.goal || undefined,
          challenge: state.challenge || undefined,
          employmentStatus: state.employment || undefined,
          dailyGoalMinutes: state.dailyGoalMinutes || undefined,
          markCompleted: state.isCompleted || undefined,
        }),
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
          let extraEmail: string | null = data.profile.email || null;
          let extraAvatar: string | null = data.profile.avatar_url || null;
          if (Platform.OS === 'web' && typeof window !== 'undefined' && data.profile.id) {
            try {
              const rawExtra = window.localStorage.getItem(`maya_user_profile_extra_${data.profile.id}`);
              if (rawExtra) {
                const parsedExtra = JSON.parse(rawExtra);
                if (!extraEmail && parsedExtra.email) extraEmail = parsedExtra.email;
                if (!extraAvatar && parsedExtra.avatarUrl) extraAvatar = parsedExtra.avatarUrl;
              }
            } catch {}
          }
          const user = {
            id: data.profile.id,
            phoneNumber: data.profile.phone_number,
            displayName: data.profile.display_name,
            email: extraEmail,
            avatarUrl: extraAvatar,
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
            telcoProvider: data.profile.telco_provider || null,
            telcoStatus: data.profile.telco_status || null,
            hasTelcoSubscription: Boolean(data.profile.has_telco_subscription ?? data.profile.telco_subscriber_id),
            isSubscriptionLocked: Boolean(data.profile.is_subscription_locked),
            isGracePeriodActive: Boolean(data.profile.is_grace_period_active),
            gracePeriodEndDate: data.profile.grace_period_end || null,
          };
          OnboardingStore.setAuthSession(token, user);

          // Auto-heal legacy cached users: if local store has preferences/completion that were never synced to DB in older builds, backfill them now
          const latestLocal = OnboardingStore.getState();
          const needsDbBackfill =
            (latestLocal.name && !data.profile.display_name) ||
            (latestLocal.goal && !data.profile.goal) ||
            (latestLocal.isCompleted && !data.profile.onboarding_completed_at);

          if (needsDbBackfill) {
            this.syncStep(latestLocal.isCompleted ? '/(tabs)/dashboard' : (latestLocal.lastActiveRoute || '/onboarding/goal'));
          }

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

  /**
   * Revokes the current access token on the backend and purges all local session caches and cookies.
   */
  async logout(): Promise<void> {
    const token = OnboardingStore.getState().accessToken;
    OnboardingStore.clear();
    if (token) {
      try {
        await fetch(`${this.baseUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {}
    }
  }

  /**
   * Submits a student complaint or feedback item to the database so it appears in the Admin Portal.
   */
  async submitComplaint(message: string): Promise<boolean> {
    const token = OnboardingStore.getState().accessToken;
    const authScheme = 'Bearer';
    try {
      const res = await fetch(`${this.baseUrl}/v1/users/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${authScheme} ${token || 'dev-token'}`,
        },
        body: JSON.stringify({ message }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();
