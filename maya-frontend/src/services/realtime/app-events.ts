import { useEffect } from 'react';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { AdminAuthStore } from '@/services/store/admin-auth-store';
import { notifyStatsChanged } from '@/services/stats-events';
import { AppEvent, bindToVisibility, EventsConnection } from './events-client';

/** The signed-in learner's connection (one per app / tab). */
export const userEvents = new EventsConnection(() => ({ token: OnboardingStore.getState().accessToken }));

/** Admin dashboards' connection (only opened on admin pages, see useAdminEvents). */
export const adminEvents = new EventsConnection(() => ({ adminToken: AdminAuthStore.getToken() }));

/**
 * Mount once at the app root. Connects while a learner is signed in and the app is visible;
 * turns server hints into local refreshes:
 *   stats.changed / payment.updated / resync -> re-fetch stats (useUserStats listens)
 * Maintenance listeners subscribe themselves (MaintenanceOverlay).
 */
export function useAppEvents() {
  useEffect(() => {
    const off = userEvents.on((e: AppEvent) => {
      if (e.type === 'stats.changed' || e.type === 'payment.updated' || e.type === 'resync') {
        notifyStatsChanged();
      }
    });
    // Reconnect / disconnect when the learner signs in or out
    let lastToken = OnboardingStore.getState().accessToken;
    const unsubStore = OnboardingStore.subscribe((s) => {
      if (s.accessToken !== lastToken) {
        lastToken = s.accessToken;
        userEvents.credentialChanged();
      }
    });
    const unbind = bindToVisibility(userEvents);
    return () => {
      off();
      unsubStore();
      unbind();
    };
  }, []);
}

/** Admin pages: keeps the admin events connection open while the page is mounted and visible. */
export function useAdminEvents(listener: (e: AppEvent) => void) {
  useEffect(() => {
    const off = adminEvents.on(listener);
    const unbind = bindToVisibility(adminEvents);
    return () => {
      off();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
