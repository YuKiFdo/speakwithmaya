import { Platform } from 'react-native';

const STORAGE_SALT = 'maya_secure_storage_salt_v1';
const CIPHER_PREFIX = 'enc:v1:';

// Helper to convert Uint8Array / ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

// Helper to convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

let cachedCryptoKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey | null> {
  if (cachedCryptoKey) return cachedCryptoKey;
  if (typeof globalThis.crypto?.subtle === 'undefined') return null;

  try {
    const encoder = new TextEncoder();
    const keyMaterial = await globalThis.crypto.subtle.digest(
      'SHA-256',
      encoder.encode(STORAGE_SALT),
    );
    cachedCryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
    return cachedCryptoKey;
  } catch (err) {
    console.warn('[EncryptedStorage] Failed to derive AES-GCM key:', err);
    return null;
  }
}

/**
 * Encrypts plain text into an AES-GCM 256-bit authenticated payload.
 * Format: `enc:v1:<base64-iv>:<base64-ciphertext>`
 */
export async function encryptData(plainText: string): Promise<string> {
  const key = await getEncryptionKey();
  if (!key || typeof globalThis.crypto?.getRandomValues === 'undefined') {
    // If WebCrypto is unavailable (e.g. extremely old runtime), fallback to encoded obfuscation
    return 'obf:v1:' + arrayBufferToBase64(new TextEncoder().encode(plainText));
  }

  try {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plainText);
    const cipherBuffer = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData,
    );

    const ivStr = arrayBufferToBase64(iv);
    const cipherStr = arrayBufferToBase64(cipherBuffer);
    return `${CIPHER_PREFIX}${ivStr}:${cipherStr}`;
  } catch (err) {
    console.warn('[EncryptedStorage] Encryption failed, falling back:', err);
    return 'obf:v1:' + arrayBufferToBase64(new TextEncoder().encode(plainText));
  }
}

/**
 * Decrypts an AES-GCM authenticated payload.
 * If tampered with, authentication fails and returns null.
 */
export async function decryptData(rawStored: string): Promise<string | null> {
  if (!rawStored) return null;

  // 1. If legacy unencrypted JSON, return directly (will be auto-encrypted on next save)
  if (rawStored.startsWith('{') || rawStored.startsWith('[')) {
    return rawStored;
  }

  // 2. Fallback obfuscation format
  if (rawStored.startsWith('obf:v1:')) {
    try {
      const b64 = rawStored.slice(7);
      const bytes = base64ToUint8Array(b64);
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  // 3. Authenticated AES-GCM format
  if (rawStored.startsWith(CIPHER_PREFIX)) {
    const parts = rawStored.slice(CIPHER_PREFIX.length).split(':');
    if (parts.length !== 2) {
      console.warn('[EncryptedStorage] ⚠️ Storage tampering detected: invalid format.');
      return null;
    }

    const [ivB64, cipherB64] = parts;
    const key = await getEncryptionKey();
    if (!key) return null;

    try {
      const iv = base64ToUint8Array(ivB64);
      const cipherBytes = base64ToUint8Array(cipherB64);
      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        cipherBytes as any,
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
      console.warn(
        '[EncryptedStorage] ⚠️ Tamper detection triggered: AES-GCM integrity check failed. Purging invalid state.',
      );
      return null;
    }
  }

  return null;
}

/**
 * Cookie storage helpers for Web.
 */
export const CookieStorage = {
  set(name: string, value: string, days: number = 30) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = `expires=${date.toUTCString()}`;
      const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
      document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/; SameSite=Lax${isHttps ? '; Secure' : ''}`;
    } catch {}
  },

  get(name: string): string | null {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    try {
      const prefix = `${name}=`;
      const cookies = document.cookie.split(';');
      for (let c of cookies) {
        c = c.trim();
        if (c.indexOf(prefix) === 0) {
          return decodeURIComponent(c.substring(prefix.length));
        }
      }
    } catch {}
    return null;
  },

  delete(name: string) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    } catch {}
  },
};
