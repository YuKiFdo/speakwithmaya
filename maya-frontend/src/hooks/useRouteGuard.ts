import { useEffect } from 'react';
import { useSegments, router } from 'expo-router';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

/**
 * Enterprise Route Guard for SpeakwithMaya.
 * 
 * Guarantees:
 * 1. Unauthorized visitors cannot access protected routes (`/(tabs)/*`, `/call/*`, `/upgrade`, `/explore`, `/admin/*`).
 * 2. Incomplete onboarding users are gracefully resumed at their exact saved step (e.g. `/onboarding/personalized-plan`).
 * 3. Fully onboarded users are automatically redirected to `/(tabs)/dashboard` instead of re-prompting for phone/OTP.
 * 4. Deleted accounts are detected in real-time, clearing local cache and ejecting to login.
 */
export function useRouteGuard() {
  const segments = useSegments();

  useEffect(() => {
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

    // 1. Fully onboarded user visiting guest/login screens
    if (state.isAuthenticated && state.isCompleted) {
      if (
        routePath === 'index' ||
        routePath === '' ||
        routePath === 'onboarding/phone' ||
        routePath === 'onboarding/otp'
      ) {
        router.replace('/(tabs)/dashboard');
        return;
      }
    }

    // 2. Protected routes guard
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
  }, [segments]);
}
