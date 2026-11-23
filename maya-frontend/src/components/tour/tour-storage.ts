import { AppStorage } from '@/services/storage/storage-adapter';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendBaseUrl } from '@/utils/backend-url';

/**
 * "Has this learner seen tour X?"
 *
 * Source of truth is the profile (`tours_seen`, GET /v1/users/tours) so a tour shows once
 * across phone app, mobile web and desktop web. A per-user local flag answers instantly on
 * the same device, so the server is asked at most once per app session and only while a
 * tour is still unseen locally.
 */

const localKey = (userId: string, tourId: string) => `maya_tour_seen:${userId}:${tourId}`;

let serverCache: { userId: string; tours: Set<string> } | null = null;
let serverInFlight: Promise<Set<string> | null> | null = null;

function session(): { userId: string; token: string } | null {
  const st = OnboardingStore.getState();
  const userId = st.user?.id;
  const token = st.accessToken;
  return userId && token ? { userId, token } : null;
}

async function fetchServerTours(userId: string, token: string): Promise<Set<string> | null> {
  if (serverCache?.userId === userId) return serverCache.tours;
  if (!serverInFlight) {
    serverInFlight = fetch(`${getBackendBaseUrl()}/v1/users/tours`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        const list: unknown = body?.toursSeen;
        const tours = new Set(Array.isArray(list) ? list.filter((t): t is string => typeof t === 'string') : []);
        serverCache = { userId, tours };
        return tours;
      })
      .catch(() => null)
      .finally(() => {
        serverInFlight = null;
      });
  }
  return serverInFlight;
}

/**
 * Resolves true if the tour was already seen. Unknown (offline / server error) counts as
 * not seen, so the worst case is showing a tour once more on a new device.
 */
export async function hasSeenTour(tourId: string): Promise<boolean> {
  const s = session();
  if (!s) return true; // signed out: never start tours
  if ((await AppStorage.getItem(localKey(s.userId, tourId))) === '1') return true;
  const server = await fetchServerTours(s.userId, s.token);
  if (server?.has(tourId)) {
    AppStorage.setItem(localKey(s.userId, tourId), '1');
    return true;
  }
  return false;
}

/** Marks the tour seen locally right away and on the profile in the background. */
export function markTourSeen(tourId: string): void {
  const s = session();
  if (!s) return;
  AppStorage.setItem(localKey(s.userId, tourId), '1');
  if (serverCache?.userId === s.userId) serverCache.tours.add(tourId);
  fetch(`${getBackendBaseUrl()}/v1/users/tours/seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
    body: JSON.stringify({ tourId }),
  }).catch(() => {});
}
