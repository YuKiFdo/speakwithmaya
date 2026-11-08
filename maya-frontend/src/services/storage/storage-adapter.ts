import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Universal Storage Adapter for SpeakwithMaya.
 * Seamlessly handles:
 * - General state & cache via AsyncStorage on native, localStorage on Web.
 * - Sensitive auth tokens via Expo SecureStore on native, Secure Cookie/localStorage on Web.
 */

// In-memory cache for fast synchronous access
const memoryCache = new Map<string, string>();

/**
 * Universal Key-Value Storage (General Data, App State, History, Roadmap Cache)
 */
export const AppStorage = {
  /**
   * Get an item from storage.
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = window.localStorage.getItem(key);
          if (val !== null) memoryCache.set(key, val);
          return val;
        }
        return memoryCache.get(key) ?? null;
      }

      // Native (iOS & Android)
      const val = await AsyncStorage.getItem(key);
      if (val !== null) memoryCache.set(key, val);
      return val;
    } catch (e) {
      console.warn(`[AppStorage] Error reading key "${key}":`, e);
      return memoryCache.get(key) ?? null;
    }
  },

  /**
   * Synchronous read if previously loaded into memory or running on Web.
   */
  getSync(key: string): string | null {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {}
    }
    return memoryCache.get(key) ?? null;
  },

  /**
   * Set an item in storage.
   */
  async setItem(key: string, value: string): Promise<void> {
    memoryCache.set(key, value);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }

      // Native (iOS & Android)
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[AppStorage] Error writing key "${key}":`, e);
    }
  },

  /**
   * Remove an item from storage.
   */
  async removeItem(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }

      // Native (iOS & Android)
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[AppStorage] Error deleting key "${key}":`, e);
    }
  },

  /**
   * Clear all matching keys by prefix.
   */
  async clearPrefix(prefix: string): Promise<void> {
    try {
      for (const k of memoryCache.keys()) {
        if (k.startsWith(prefix)) memoryCache.delete(k);
      }

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = window.localStorage.length - 1; i >= 0; i--) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(prefix)) {
              window.localStorage.removeItem(k);
            }
          }
        }
        return;
      }

      // Native (iOS & Android)
      const allKeys = await AsyncStorage.getAllKeys();
      const targetKeys = (allKeys as string[]).filter((k: string) => k.startsWith(prefix));
      if (targetKeys.length > 0) {
        await AsyncStorage.multiRemove(targetKeys);
      }
    } catch (e) {
      console.warn(`[AppStorage] Error clearing prefix "${prefix}":`, e);
    }
  },
};

/**
 * Secure Storage for Authentication Tokens & Private Credentials
 * Uses iOS Keychain & Android Keystore on native, CookieStorage on Web.
 */
export const SecureTokenStorage = {
  /**
   * Read auth token
   */
  async getToken(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
          if (match) return decodeURIComponent(match[1]);
        }
        return AppStorage.getSync(key);
      }

      // Native (iOS Keychain & Android Keystore)
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        return await SecureStore.getItemAsync(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn(`[SecureTokenStorage] Error reading token "${key}":`, e);
      return null;
    }
  },

  /**
   * Save auth token
   */
  async setToken(key: string, token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          document.cookie = `${key}=${encodeURIComponent(token)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
        }
        await AppStorage.setItem(key, token);
        return;
      }

      // Native (iOS Keychain & Android Keystore)
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.setItemAsync(key, token, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } else {
        await AsyncStorage.setItem(key, token);
      }
    } catch (e) {
      console.warn(`[SecureTokenStorage] Error setting token "${key}":`, e);
    }
  },

  /**
   * Delete auth token
   */
  async removeToken(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
        }
        await AppStorage.removeItem(key);
        return;
      }

      // Native (iOS Keychain & Android Keystore)
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[SecureTokenStorage] Error deleting token "${key}":`, e);
    }
  },
};

