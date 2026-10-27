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
  private adminToken: string | null = null;
  private hydrated = false;
  private listeners = new Set<Listener>();

  constructor() {
    this.hydrate();
    this.installAdminFetchInterceptor();
  }

  private installAdminFetchInterceptor() {
    if (typeof globalThis.fetch !== 'function' || (globalThis as any).__mayaAdminFetchPatched) {
      return;
    }
    (globalThis as any).__mayaAdminFetchPatched = true;
    const originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request)?.url || '';

      if (urlStr.includes('/v1/admin') && !urlStr.includes('/v1/admin/login')) {
        const token = this.getToken();
        if (token) {
          const headers = new Headers(init?.headers || {});
          if (!headers.has('x-admin-token')) {
            headers.set('x-admin-token', token);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
      return originalFetch(input, init);
    };
  }

  private hydrate() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.isAuthenticated === true) {
            this.authenticated = true;
            const user = (parsed.username || 'speakwithmaya').trim().toLowerCase();
            this.adminToken = parsed.token || `maya-admin-portal-v1:${user}`;
          }
        }
      } catch {
        this.authenticated = false;
        this.adminToken = null;
      }
    }
    this.hydrated = true;
  }

  getToken(): string | null {
    if (!this.hydrated) {
      this.hydrate();
    }
    return this.adminToken;
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
      this.adminToken = `maya-admin-portal-v1:${normalizedUser}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(
            ADMIN_AUTH_STORAGE_KEY,
            JSON.stringify({
              isAuthenticated: true,
              username: normalizedUser,
              token: this.adminToken,
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
    this.adminToken = null;
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
