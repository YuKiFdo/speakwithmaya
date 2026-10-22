import { Platform } from 'react-native';

const ADMIN_AUTH_STORAGE_KEY = 'maya_admin_auth_session_v1';

const VALID_ADMIN_USERNAMES = new Set([
  'speakwithmaya',
  'speakwtihmya',
  'speakwtihmaya',
]);

const VALID_ADMIN_PASSWORDS = new Set([
  'admin123',
  'admin 123',
]);

type Listener = (isAuthenticated: boolean) => void;

class AdminAuthStoreClass {
  private authenticated = false;
  private hydrated = false;
  private listeners = new Set<Listener>();

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.isAuthenticated === true) {
            this.authenticated = true;
          }
        }
      } catch {
        this.authenticated = false;
      }
    }
    this.hydrated = true;
  }

  isAuthenticated(): boolean {
    if (!this.hydrated) {
      this.hydrate();
    }
    return this.authenticated;
  }

  login(usernameInput: string, passwordInput: string): boolean {
    const normalizedUser = (usernameInput || '').trim().toLowerCase();
    const normalizedPass = (passwordInput || '').trim();

    if (
      VALID_ADMIN_USERNAMES.has(normalizedUser) &&
      VALID_ADMIN_PASSWORDS.has(normalizedPass)
    ) {
      this.authenticated = true;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(
            ADMIN_AUTH_STORAGE_KEY,
            JSON.stringify({
              isAuthenticated: true,
              username: normalizedUser,
              loggedInAt: new Date().toISOString(),
            }),
          );
        } catch {}
      }
      this.notify();
      return true;
    }

    return false;
  }

  logout(): void {
    this.authenticated = false;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
      } catch {}
    }
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.authenticated));
  }
}

export const AdminAuthStore = new AdminAuthStoreClass();
