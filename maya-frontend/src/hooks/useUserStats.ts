import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useOnboardingStore } from '@/services/store/onboarding-store';
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
  isPastDue: boolean;

  // Level & XP
  completedLessonsCount: number;
  currentLevelNumber: number;
  levelLabel: string;
  xpLabel: string;
  totalXp: number;
  levelXp: number;
  targetLevelXp: number;
  progress: number; // 0 to 1

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

function calculateResetsIn(resetAt?: string): string {
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

  const [completedLessonsCount, setCompletedLessonsCount] = useState<number>(0);
  const [earnedXp, setEarnedXp] = useState<number>(0);

  const planTier = user?.planTier || 'starter';
  const isPro = planTier === 'pro' || planTier === 'premium';
  const monthlyMinutesAllowance = user?.monthlyMinutesAllowance ?? (isPro ? 600 : 10);
  const minutesBalance = user?.minutesBalance ?? monthlyMinutesAllowance;
  // If user purchased top-ups, total minutes includes the additional top-up balance
  const totalMinutes = Math.max(monthlyMinutesAllowance, minutesBalance);
  const usedMinutes = Math.max(0, totalMinutes - minutesBalance);
  const isTimeExpired = minutesBalance <= 0;
  const resetsInText = calculateResetsIn(user?.minutesResetAt);

  const displayName = user?.displayName || store.name || 'Learner';
  const initials = computeInitials(displayName);
  const phoneNumber = user?.phoneNumber || store.phone || '';
  const rawLang = user?.nativeLanguage || store.nativeLanguage || 'sinhala';
  const nativeLanguageDisplay = rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
  const memberSinceText = formatMemberSince(user?.createdAt);
  const dailyMins = user?.dailyGoalMinutes || store.dailyGoalMinutes || 10;
  const dailyGoalDisplay = `${dailyMins} min daily`;

  const refreshStats = useCallback(async () => {
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

      if (progressRes && progressRes.ok) {
        try {
          const data = await progressRes.json();
          if (Array.isArray(data.progress)) {
            data.progress.forEach((p: any) => {
              if (p.status === 'completed' || p.isPassed) {
                completedIds.add(p.roadmapLevelId || String(p.levelNumber));
                totalXpAccumulated += p.xpEarned || 100;
              }
            });
          }
        } catch {}
      }

      if (Array.isArray(sessions)) {
        sessions.forEach((s: any) => {
          if (s.status === 'completed' && s.roadmap_level_id) {
            if (!completedIds.has(s.roadmap_level_id)) {
              completedIds.add(s.roadmap_level_id);
              totalXpAccumulated += 100;
            }
          }
        });
      }

      setCompletedLessonsCount(completedIds.size);
      setEarnedXp(totalXpAccumulated);
    } catch {}
  }, [store.accessToken]);

  useEffect(() => {
    // Initial fetch on mount
    refreshStats();

    // Auto-sync when window / browser tab regains focus or becomes visible
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleFocus = () => {
        refreshStats();
      };
      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          refreshStats();
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Periodic background sync every 60 seconds to ensure session matches DB
      const intervalId = setInterval(refreshStats, 60000);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [refreshStats]);

  // Dynamic Level & XP calculations (500 XP per level, starting at Level 1)
  const XP_PER_LEVEL = 500;
  const totalXp = earnedXp;
  const currentLevelNumber = Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1);
  const levelXp = totalXp % XP_PER_LEVEL;
  const targetLevelXp = XP_PER_LEVEL;
  const progress = Math.min(1, Math.max(0, levelXp / targetLevelXp));
  const levelLabel = `Level ${currentLevelNumber}`;
  const xpLabel = `${levelXp} / ${targetLevelXp} XP`;

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
    isPastDue: user?.planStatus === 'past_due',
    completedLessonsCount,
    currentLevelNumber,
    levelLabel,
    xpLabel,
    totalXp,
    levelXp,
    targetLevelXp,
    progress,
    displayName,
    initials,
    phoneNumber,
    nativeLanguageDisplay,
    memberSinceText,
    dailyGoalDisplay,
    refreshStats,
  };
}
