import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useOnboardingStore, OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { fetchAllPracticeSessions } from '@/services/supabase';
import { authService } from '@/services/auth/auth-service';

export interface UserStats {
  // Quota & Minutes
  minutesBalance: number;
  monthlyMinutesAllowance: number;
  usedMinutes: number;
  totalMinutes: number;
  resetsInText: string;
  isTimeExpired: boolean;
  isPro: boolean;
  planTier: 'starter' | 'basic' | 'pro' | 'premium';
  planStatus: string;
  isTestAccount: boolean;
  isPastDue: boolean;
  hasTelcoSubscription: boolean;
  isTelcoUnsubscribed: boolean;
  telcoProvider: 'ideamart' | 'mspace' | null;
  isSubscriptionLocked: boolean;
  isGracePeriodActive: boolean;
  gracePeriodEndDate: string | null;

  // Level, XP & Rank
  completedLessonsCount: number;
  currentLevelNumber: number;
  levelLabel: string;
  xpLabel: string;
  totalXp: number;
  levelXp: number;
  targetLevelXp: number;
  progress: number; // 0 to 1
  rank: number | null;
  practicedMinutes: number;

  // User Profile
  displayName: string;
  initials: string;
  phoneNumber: string;
  nativeLanguageDisplay: string;
  memberSinceText: string;
  dailyGoalDisplay: string;

  // Actions
  refreshStats: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level & XP Persistent & In-Memory Instant Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CachedStats {
  earnedXp: number;
  completedLessonsCount: number;
  rank: number | null;
  practicedMinutes: number;
}

const STATS_CACHE_KEY_PREFIX = 'maya_user_stats_cache_';
const STATS_CACHE_KEY_DEFAULT = 'maya_user_stats_cache_v1';

function getStoredStatsCache(userId?: string): CachedStats | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (userId) {
        const userRaw = window.localStorage.getItem(`${STATS_CACHE_KEY_PREFIX}${userId}`);
        if (userRaw) {
          const parsed = JSON.parse(userRaw);
          if (typeof parsed.earnedXp === 'number') {
            return {
              earnedXp: parsed.earnedXp,
              completedLessonsCount: parsed.completedLessonsCount || 0,
              rank: typeof parsed.rank === 'number' && parsed.rank > 0 ? parsed.rank : null,
              practicedMinutes: parsed.practicedMinutes || 0,
            };
          }
        }
      }
      const raw = window.localStorage.getItem(STATS_CACHE_KEY_DEFAULT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.earnedXp === 'number') {
          return {
            earnedXp: parsed.earnedXp,
            completedLessonsCount: parsed.completedLessonsCount || 0,
            rank: typeof parsed.rank === 'number' && parsed.rank > 0 ? parsed.rank : null,
            practicedMinutes: parsed.practicedMinutes || 0,
          };
        }
      }
    } catch {}
  }
  return null;
}

function loadInitialStatsCache(): CachedStats {
  return getStoredStatsCache() || { earnedXp: 0, completedLessonsCount: 0, rank: null, practicedMinutes: 0 };
}

let globalStatsCache: CachedStats = loadInitialStatsCache();
const statsListeners = new Set<(stats: CachedStats) => void>();
let inFlightRefreshPromise: Promise<void> | null = null;

function updateGlobalStats(newStats: CachedStats, userId?: string) {
  globalStatsCache = newStats;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STATS_CACHE_KEY_DEFAULT, JSON.stringify(newStats));
      if (userId) {
        window.localStorage.setItem(`${STATS_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(newStats));
      }
    } catch {}
  }
  for (const listener of statsListeners) {
    listener(globalStatsCache);
  }
}

export function clearStatsCache() {
  globalStatsCache = { earnedXp: 0, completedLessonsCount: 0, rank: null, practicedMinutes: 0 };
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STATS_CACHE_KEY_DEFAULT);
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STATS_CACHE_KEY_PREFIX)) {
          window.localStorage.removeItem(k);
        }
      }
    } catch {}
  }
  for (const listener of statsListeners) {
    listener(globalStatsCache);
  }
}

// Clear memory/storage cache on logout
OnboardingStore.subscribe((state) => {
  if (!state.isAuthenticated && (globalStatsCache.earnedXp > 0 || globalStatsCache.completedLessonsCount > 0)) {
    clearStatsCache();
  }
});

function calculateResetsIn(resetAt?: string, isStarter: boolean = false): string {
  if (isStarter) {
    return 'Resets daily';
  }
  if (!resetAt) return 'Resets in 30 days';
  try {
    const diffMs = new Date(resetAt).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Resets today';
    if (diffDays === 1) return 'Resets tomorrow';
    return `Resets in ${diffDays} days`;
  } catch {
    return 'Resets in 30 days';
  }
}

function computeInitials(name: string): string {
  if (!name || !name.trim()) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMemberSince(dateStr?: string): string {
  if (!dateStr) return 'Member since today';
  try {
    const date = new Date(dateStr);
    return `Member since ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  } catch {
    return 'Member since 2026';
  }
}

export function useUserStats(): UserStats {
  const store = useOnboardingStore();
  const user = store.user;

  // Initialize immediately from synchronous cache so Level and XP show with 0ms delay
  const [statsState, setStatsState] = useState<CachedStats>(() => {
    if (user?.id) {
      const userCached = getStoredStatsCache(user.id);
      if (userCached) return userCached;
    }
    return globalStatsCache;
  });

  useEffect(() => {
    // Keep local component state in sync with global cache updates
    const listener = (newStats: CachedStats) => {
      setStatsState(newStats);
    };
    statsListeners.add(listener);
    return () => {
      statsListeners.delete(listener);
    };
  }, []);

  // When user ID is hydrated, load user-specific stats cache if available
  useEffect(() => {
    if (user?.id) {
      const userCached = getStoredStatsCache(user.id);
      if (
        userCached &&
        (userCached.earnedXp !== statsState.earnedXp ||
          userCached.completedLessonsCount !== statsState.completedLessonsCount)
      ) {
        updateGlobalStats(userCached, user.id);
      }
    }
  }, [user?.id]);

  const planTier = (user?.planTier || 'starter').toLowerCase() as 'starter' | 'basic' | 'pro' | 'premium';
  const isStarter = planTier === 'starter';
  const isPro = planTier === 'pro' || planTier === 'premium' || planTier === 'basic';
  const defaultMonthlyAllowance = planTier === 'premium' ? 1200 : planTier === 'pro' ? 900 : planTier === 'basic' ? 600 : 3;
  const monthlyMinutesAllowance = isStarter
    ? Math.min(3, user?.monthlyMinutesAllowance ?? 3)
    : (user?.monthlyMinutesAllowance ?? defaultMonthlyAllowance);
  const addOnMinutesBalance = user?.addOnMinutesBalance ?? 0;
  const minutesBalance = user?.minutesBalance ?? (monthlyMinutesAllowance + addOnMinutesBalance);

  // Total available talk time capacity for this billing cycle = monthly plan allowance + all add-on top-ups
  const effectiveAddOn = addOnMinutesBalance > 0
    ? addOnMinutesBalance
    : Math.max(0, minutesBalance - monthlyMinutesAllowance);
  const totalMinutes = monthlyMinutesAllowance + effectiveAddOn;
  const usedMinutes = Math.max(0, totalMinutes - minutesBalance);
  const isTimeExpired = minutesBalance <= 0;
  const resetsInText = calculateResetsIn(user?.minutesResetAt, isStarter);

  const displayName = user?.displayName || store.name || 'Learner';
  const initials = computeInitials(displayName);
  const phoneNumber = user?.phoneNumber || store.phone || '';
  const rawLang = user?.nativeLanguage || store.nativeLanguage || 'sinhala';
  const nativeLanguageDisplay = rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
  const memberSinceText = formatMemberSince(user?.createdAt);
  const dailyMins = user?.dailyGoalMinutes || store.dailyGoalMinutes || 10;
  const dailyGoalDisplay = `${dailyMins} min daily`;

  const refreshStats = useCallback(async () => {
    // If running on web and currently on an admin route, or if no user is authenticated, skip network sync
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return;
    }
    if (!store.accessToken && !user?.id) {
      return;
    }

    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    inFlightRefreshPromise = (async () => {
      try {
        // 1. Always sync user profile, quotas, and preferences directly from database
        await authService.fetchUserProfile();

        // 2. Fetch roadmap progress and practice sessions
        const baseUrl = getBackendBaseUrl();
        const token = store.accessToken;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [progressRes, sessions] = await Promise.all([
          fetch(`${baseUrl}/v1/roadmap/user-progress`, { headers }).catch(() => null),
          fetchAllPracticeSessions().catch(() => []),
        ]);

        const completedIds = new Set<string>();
        let totalXpAccumulated = 0;
        let serverRank: number | null = null;
        let serverMinutesConsumed: number = 0;

        if (progressRes && progressRes.ok) {
          try {
            const data = await progressRes.json();
            if (typeof data.rank === 'number' && data.rank > 0) {
              serverRank = data.rank;
            }
            if (typeof data.minutesConsumed === 'number') {
              serverMinutesConsumed = data.minutesConsumed;
            }
            if (Array.isArray(data.progress)) {
              data.progress.forEach((p: any) => {
                if (p.status === 'completed' || p.isPassed) {
                  completedIds.add(p.roadmapLevelId || String(p.levelNumber));
                  totalXpAccumulated += typeof p.xpEarned === 'number' ? p.xpEarned : Number(p.xpEarned) || 0;
                }
              });
            }
          } catch {}
        }

        let totalSessionSeconds = 0;
        if (Array.isArray(sessions)) {
          sessions.forEach((s: any) => {
            totalSessionSeconds += Number(s.duration_seconds || 0);
          });
        }

        const practicedMinutes = Math.max(
          serverMinutesConsumed,
          Math.round(totalSessionSeconds / 60),
          usedMinutes,
        );

        // If the user has 0 XP and 0 practiced minutes, their rank is null (displayed as N/A)
        const hasActivity = totalXpAccumulated > 0 || practicedMinutes > 0;
        const effectiveRank: number | null =
          !hasActivity
            ? null
            : serverRank && serverRank > 0
            ? serverRank
            : null;

        updateGlobalStats(
          {
            completedLessonsCount: completedIds.size,
            earnedXp: totalXpAccumulated,
            rank: effectiveRank,
            practicedMinutes,
          },
          user?.id,
        );
      } catch {}
      finally {
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  }, [store.accessToken, user?.id]);

  useEffect(() => {
    // Initial fetch on mount
    refreshStats();

    // Auto-sync when window / browser tab regains focus or becomes visible
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleFocus = () => {
        if (!window.location.pathname.startsWith('/admin')) {
          refreshStats();
        }
      };
      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !window.location.pathname.startsWith('/admin')) {
          refreshStats();
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Periodic background sync every 60 seconds to ensure session matches DB
      const intervalId = setInterval(() => {
        if (!window.location.pathname.startsWith('/admin')) {
          refreshStats();
        }
      }, 60000);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [refreshStats]);

  // Dynamic Level & XP calculations (500 XP per level, starting at Level 1)
  const XP_PER_LEVEL = 500;
  const totalXp = statsState.earnedXp;
  const currentLevelNumber = Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1);
  const levelXp = totalXp % XP_PER_LEVEL;
  const targetLevelXp = XP_PER_LEVEL;
  const progress = Math.min(1, Math.max(0, levelXp / targetLevelXp));
  const levelLabel = `Level ${currentLevelNumber}`;
  const xpLabel = `${levelXp} / ${targetLevelXp} XP`;

    const effectivePracticedMinutes = statsState.practicedMinutes || usedMinutes;
    const hasActivity = totalXp > 0 || effectivePracticedMinutes > 0;

    return {
      minutesBalance,
      monthlyMinutesAllowance,
      usedMinutes,
      totalMinutes,
      resetsInText,
      isTimeExpired,
      isPro,
      planTier,
      planStatus: user?.planStatus || 'active',
      isTestAccount: user?.isTestAccount === true,
      isPastDue: user?.planStatus === 'past_due',
      hasTelcoSubscription: Boolean(user?.hasTelcoSubscription),
      isTelcoUnsubscribed: user?.telcoStatus === 'UNSUBSCRIBED',
      telcoProvider: user?.telcoProvider || null,
      isSubscriptionLocked: Boolean(
        user?.isSubscriptionLocked ||
        (user?.hasTelcoSubscription && user?.telcoStatus === 'UNSUBSCRIBED') ||
        user?.planStatus === 'expired'
      ),
      isGracePeriodActive: Boolean(user?.isGracePeriodActive),
      gracePeriodEndDate: user?.gracePeriodEndDate || null,
      completedLessonsCount: statsState.completedLessonsCount,
      currentLevelNumber,
      levelLabel,
      xpLabel,
      totalXp,
      levelXp,
      targetLevelXp,
      progress,
      rank: hasActivity ? statsState.rank : null,
      practicedMinutes: effectivePracticedMinutes,
      displayName,
    initials,
    phoneNumber,
    nativeLanguageDisplay,
    memberSinceText,
    dailyGoalDisplay,
    refreshStats,
  };
}
