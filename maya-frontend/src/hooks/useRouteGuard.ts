import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSegments, router } from 'expo-router';
import { OnboardingStore, OnboardingState } from '@/services/store/onboarding-store';
import { AdminAuthStore } from '@/services/store/admin-auth-store';
import { authService } from '@/services/auth/auth-service';

/**
 * Ordered prerequisite map for the onboarding funnel.
 * Each entry defines a route and a predicate that MUST be true for the user
 * to be allowed on that screen. If the predicate fails, the user is
 * redirected to the earliest step whose prerequisites ARE met.
 */
const ONBOARDING_STEP_CHAIN: {
  route: string;
  /** Returns true if the user has completed enough prior steps to be here */
  canAccess: (s: OnboardingState) => boolean;
}[] = [
  // Step 1-3: Pre-auth screens - only for unauthenticated visitors
  { route: 'onboarding/name',         canAccess: (s) => !s.isAuthenticated },
  { route: 'onboarding/phone',        canAccess: (s) => !s.isAuthenticated },
  { route: 'onboarding/otp',          canAccess: (s) => !s.isAuthenticated && !!s.phone },
  // Step 4-10: Questionnaire steps - only before onboarding is marked completed / dashboard entered
  { route: 'onboarding/goal',         canAccess: (s) => s.isAuthenticated && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/challenge',    canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/level',        canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/language',     canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/employment',   canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/daily-goal',   canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  { route: 'onboarding/social-proof', canAccess: (s) => s.isAuthenticated && !!s.goal && !s.isCompleted && !s.hasEnteredDashboard },
  // Step 11+: Post-intro onboarding steps - only allowed before user has entered the Dashboard
  { route: 'onboarding/call',         canAccess: (s) => s.isAuthenticated && !!s.goal && !s.hasEnteredDashboard },
  { route: 'onboarding/connecting',   canAccess: (s) => s.isAuthenticated && !!s.goal && !s.hasEnteredDashboard },
  { route: 'onboarding/analyzing',    canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/feedback',     canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/session-review', canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/building-plan',  canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/special-offer',  canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/claim-discount', canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/personalized-plan', canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
  { route: 'onboarding/complete',     canAccess: (s) => s.isAuthenticated && !s.hasEnteredDashboard },
];

/**
 * Given the current state, find the earliest step the user should be redirected to
 * when they try to access a route they haven't earned yet.
 */
function findEarliestAllowedStep(state: OnboardingState): string {
  // Authenticated user with a valid token: NEVER send back to name/phone/otp registration!
  if (state.isAuthenticated) {
    if (state.isCompleted) return '/(tabs)/dashboard';
    if (!state.goal) return '/onboarding/goal';
    if (
      state.lastActiveRoute &&
      state.lastActiveRoute !== '/' &&
      !state.lastActiveRoute.startsWith('/onboarding/name') &&
      !state.lastActiveRoute.startsWith('/onboarding/phone') &&
      !state.lastActiveRoute.startsWith('/onboarding/otp')
    ) {
      return state.lastActiveRoute;
    }
    return '/onboarding/goal';
  }

  // If not authenticated and no name, start from scratch
  if (!state.name) return '/onboarding/name';
  return '/onboarding/phone';
}

/**
 * Enterprise Route Guard for SpeakwithMaya.
 * 
 * Guarantees:
 * 1. Unauthorized visitors cannot access protected routes (`/(tabs)/*`, `/call/*`, `/upgrade`, `/explore`, `/admin/*`).
 * 2. Incomplete onboarding users are gracefully resumed at their exact saved step (e.g. `/onboarding/personalized-plan`).
 * 3. Fully onboarded users are automatically redirected to `/(tabs)/dashboard` instead of re-prompting for phone/OTP.
 * 4. Deleted accounts are detected in real-time, clearing local cache and ejecting to login.
 * 5. Onboarding steps enforce prerequisites - no skipping ahead without completing prior steps.
 * 6. Waits for encrypted storage hydration before making any routing decisions.
 */
export function useRouteGuard() {
  const segments = useSegments();
  const [isHydrated, setIsHydrated] = useState(OnboardingStore.getState().isHydrated);

  // Wait for encrypted storage hydration before activating guards
  useEffect(() => {
    if (isHydrated) return;

    let mounted = true;
    OnboardingStore.waitForHydration().then(() => {
      if (mounted) setIsHydrated(true);
    });

    // Also listen for state changes (hydration completes via notify())
    const unsub = OnboardingStore.subscribe((state) => {
      if (state.isHydrated && mounted) setIsHydrated(true);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [isHydrated]);

  useEffect(() => {
    // Don't run guards until storage is fully hydrated
    if (!isHydrated) return;
    if (!segments || !segments[0]) return;

    const routePath = segments.join('/');

    // 0. If accessed via admin.* subdomain at root, route directly into Admin Portal
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.hostname.startsWith('admin.') &&
      (routePath === 'index' || routePath === '')
    ) {
      router.replace((AdminAuthStore.isAuthenticated() ? '/admin/users' : '/admin/login') as any);
      return;
    }

    // 1. Dedicated Admin Portal guard (/admin/*) - completely independent of student phone login
    if (segments[0] === 'admin') {
      const isAdminLoggedIn = AdminAuthStore.isAuthenticated();
      if (routePath === 'admin/login') {
        if (isAdminLoggedIn) {
          router.replace('/admin/users' as any);
        }
        return;
      }
      if (!isAdminLoggedIn) {
        router.replace('/admin/login' as any);
      }
      return;
    }

    const state = OnboardingStore.getState();
    const isGuestAuthScreen =
      routePath === 'index' ||
      routePath === '' ||
      routePath === 'onboarding/phone' ||
      routePath === 'onboarding/otp' ||
      routePath === 'onboarding/name';

    // Real-time check: If user claims to be authenticated, verify account is not deleted in DB
    if (state.isAuthenticated) {
      authService.fetchUserProfile().then((profile) => {
        const latestState = OnboardingStore.getState();
        if (!profile && !latestState.isAuthenticated) {
          router.replace('/onboarding/name');
          return;
        }
        if (profile && isGuestAuthScreen) {
          const target = latestState.isCompleted
            ? '/(tabs)/dashboard'
            : findEarliestAllowedStep(latestState);
          router.replace(target as any);
        }
      });
    }

    // 2. Any authenticated user visiting guest/register/login screens → dashboard or active post-auth step
    if (state.isAuthenticated && isGuestAuthScreen) {
      const target = state.isCompleted
        ? '/(tabs)/dashboard'
        : findEarliestAllowedStep(state);
      router.replace(target as any);
      return;
    }

    // 3. Onboarding step prerequisite enforcement
    if (segments[0] === 'onboarding') {
      // If user is authenticated and has already completed onboarding & entered the dashboard, block all /onboarding/* routes
      if (state.isAuthenticated && state.hasEnteredDashboard) {
        router.replace('/(tabs)/dashboard' as any);
        return;
      }

      const stepDef = ONBOARDING_STEP_CHAIN.find((s) => s.route === routePath);
      if (stepDef && !stepDef.canAccess(state)) {
        // User is trying to access a step they haven't earned or have already completed
        const redirectTo = findEarliestAllowedStep(state);
        // Prevent redirect loops
        if (redirectTo !== `/${routePath}`) {
          router.replace(redirectTo as any);
        }
        return;
      }
    }

    // 4. Protected student routes guard (dashboard, call, explore, etc.)
    const isProtected =
      segments[0] === '(tabs)' ||
      segments[0] === 'call' ||
      segments[0] === 'explore' ||
      segments[0] === 'upgrade' ||
      segments[0] === 'leaderboard' ||
      segments[0] === 'history';

    if (isProtected) {
      // If not authenticated, route to /onboarding/name (or /onboarding/phone if name is already set)
      if (!state.isAuthenticated) {
        router.replace(findEarliestAllowedStep(state) as any);
        return;
      }

      // If authenticated but onboarding has not been finalized, resume at active step
      if (!state.isCompleted && (segments[0] === '(tabs)' || segments[0] === 'call')) {
        const resumeRoute =
          state.goal && state.lastActiveRoute
            ? state.lastActiveRoute
            : '/onboarding/goal';
        router.replace(resumeRoute as any);
        return;
      }

      // Once an authenticated, completed user enters the main app tabs, lock out all /onboarding/* routes
      if (state.isCompleted && segments[0] === '(tabs)' && !state.hasEnteredDashboard) {
        OnboardingStore.markDashboardEntered();
      }
    }
  }, [segments, isHydrated]);
}
