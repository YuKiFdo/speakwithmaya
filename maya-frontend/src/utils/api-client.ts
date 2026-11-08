import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getBackendBaseUrl } from './backend-url';
import { OnboardingStore } from '@/services/store/onboarding-store';

/**
 * Universal Axios client configured for Maya AI.
 *
 * Handles:
 * 1. Automatic base URL resolution (production on native, localhost for local web).
 * 2. Automatic bearer token attachment from OnboardingStore.
 * 3. Prevention of Android OkHttp zstd binary corruption via `Accept-Encoding: identity`.
 * 4. Cache-busting headers to prevent 304 empty responses when state is not cached.
 * 5. Sensible default timeouts.
 */
export const apiClient: AxiosInstance = axios.create({
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Accept-Encoding': 'identity',
    'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

apiClient.interceptors.request.use((config) => {
  // Dynamically set baseURL if relative path is used
  if (!config.baseURL && !config.url?.startsWith('http')) {
    config.baseURL = getBackendBaseUrl();
  }

  // Attach auth token if available
  try {
    const token = OnboardingStore.getState().accessToken;
    if (token && typeof token === 'string') {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {}

  // Guarantee headers are set on every request
  config.headers.set('Accept-Encoding', 'identity');
  config.headers.set('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');

  return config;
});

