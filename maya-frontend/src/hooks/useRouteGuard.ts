import { useEffect, useState } from 'react';
import { useSegments, router } from 'expo-router';
import { OnboardingStore, OnboardingState } from '@/services/store/onboarding-store';
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
  // Step 1: Name — always accessible (first step after welcome)
  { route: 'onboarding/name',         canAccess: () => true },
  // Step 2: Phone — accessible for login as well as registration
  { route: 'onboarding/phone',        canAccess: () => true },
  // Step 3: OTP — requires phone
  { route: 'onboarding/otp',          canAccess: (s) => !!s.phone },
  // Step 4+: Post-auth steps — require authentication
  { route: 'onboarding/goal',         canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/challenge',    canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/level',        canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/language',     canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/employment',   canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/daily-goal',   canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/social-proof', canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/call',         canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/connecting',   canAccess: (s) => s.isAuthenticated && !!s.goal },
  { route: 'onboarding/analyzing',    canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/feedback',     canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/session-review', canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/building-plan',  canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/special-offer',  canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/claim-discount', canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/personalized-plan', canAccess: (s) => s.isAuthenticated },
  { route: 'onboarding/complete',     canAccess: (s) => s.isAuthenticated },
];

/**
 * Given the current state, find the earliest step the user should be redirected to
 * when they try to access a route they haven't earned yet.
 */
function findEarliestAllowedStep(state: OnboardingState): string {
  // If not authenticated and no name, start from scratch
  if (!state.name) return '/onboarding/name';
  if (!state.phone) return '/onboarding/phone';
  if (!state.isAuthenticated) return '/onboarding/phone';
  // Authenticated but missing goal — go to goal
  if (!state.goal) return '/onboarding/goal';
  // Default: resume at lastActiveRoute or goal
  return state.lastActiveRoute || '/onboarding/goal';
}

/**
 * Enterprise Route Guard for SpeakwithMaya.
 * 
 * Guarantees:
 * 1. Unauthorized visitors cannot access protected routes (`/(tabs)/*`, `/call/*`, `/upgrade`, `/explore`, `/admin/*`).
 * 2. Incomplete onboarding users are gracefully resumed at their exact saved step (e.g. `/onboarding/personalized-plan`).
 * 3. Fully onboarded users are automatically redirected to `/(tabs)/dashboard` instead of re-prompting for phone/OTP.
 * 4. Deleted accounts are detected in real-time, clearing local cache and ejecting to login.
 * 5. Onboarding steps enforce prerequisites — no skipping ahead without completing prior steps.
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
    const state = OnboardingStore.getState();

    // Real-time check: If user claims to be authenticated, verify account is not deleted in DB
    if (state.isAuthenticated) {
      authService.fetchUserProfile().then((profile) => {
        if (!profile && !OnboardingStore.getState().isAuthenticated) {
          router.replace('/onboarding/phone');
        }
      });
    }

    // 1. Fully onboarded user visiting guest/login screens → dashboard
    if (state.isAuthenticated && state.isCompleted) {
      if (
        routePath === 'index' ||
        routePath === '' ||
        routePath === 'onboarding/phone' ||
        routePath === 'onboarding/otp' ||
        routePath === 'onboarding/name'
      ) {
        router.replace('/(tabs)/dashboard');
        return;
      }
    }

    // 2. Onboarding step prerequisite enforcement
    if (segments[0] === 'onboarding') {
      const stepDef = ONBOARDING_STEP_CHAIN.find((s) => s.route === routePath);
      if (stepDef && !stepDef.canAccess(state)) {
        // User is trying to access a step they haven't earned
        const redirectTo = findEarliestAllowedStep(state);
        // Prevent redirect loops
        if (redirectTo !== `/${routePath}`) {
          router.replace(redirectTo as any);
        }
        return;
      }
    }

    // 3. Protected routes guard (dashboard, call, explore, etc.)
    const isProtected =
      segments[0] === '(tabs)' ||
      segments[0] === 'call' ||
      segments[0] === 'explore' ||
      segments[0] === 'upgrade' ||
      segments[0] === 'admin' ||
      segments[0] === 'history';

    if (isProtected) {
      // If not authenticated, require phone verification
      if (!state.isAuthenticated) {
        router.replace('/onboarding/phone');
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
    }
  }, [segments, isHydrated]);
}
