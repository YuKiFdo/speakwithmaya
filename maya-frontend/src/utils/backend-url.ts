import { Platform } from 'react-native';

/**
 * Single source of truth for resolving the backend base URL.
 *
 * - **Web (localhost):** Points to local dev server `http://127.0.0.1:3000`.
 * - **Web (production domains):** Points to the matching production backend.
 * - **Native (Android/iOS):** Always uses the production backend
 *   `https://api.speakwithmaya.com`, even during `expo start` dev builds,
 *   because Android emulators/devices cannot reach the host's `localhost`.
 */
export function getBackendBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Local web development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3000';
    }

    // Production domain
    if (hostname.endsWith('speakwithmaya.com')) {
      return 'https://api.speakwithmaya.com';
    }

    // Azure staging / preview environments
    if (
      hostname.includes('azurecontainerapps.io') ||
      hostname.includes('azurewebsites.net') ||
      hostname.includes('southeastasia')
    ) {
      return 'https://maya-backend.icyisland-5baf2c26.southeastasia.azurecontainerapps.io';
    }

    // Fallback: honour env var if it's not a localhost value
    const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }

    return 'https://api.speakwithmaya.com';
  }

  // Native (Android / iOS): always use production backend
  return 'https://api.speakwithmaya.com';
}

/**
 * Derives the WebSocket URL from the backend HTTP base URL.
 * e.g. `https://api.speakwithmaya.com` → `wss://api.speakwithmaya.com/live-session`
 */
export function getBackendWsUrl(path = '/live-session'): string {
  const httpBase = getBackendBaseUrl();
  const wsProto = httpBase.startsWith('https') ? 'wss' : 'ws';
  const host = httpBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${wsProto}://${host}${path}`;
}

