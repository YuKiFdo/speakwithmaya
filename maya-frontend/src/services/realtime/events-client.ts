import { AppState, Platform } from 'react-native';
import { getBackendBaseUrl } from '@/utils/backend-url';

/**
 * Client for the /events WebSocket: server -> app "something changed" hints that replace polling.
 *
 *  - Open ONLY while needed: a user (or admin) is signed in AND the app is visible / foreground.
 *    Closed when hidden, backgrounded, or signed out. Re-opened when visible again.
 *  - The token goes in the first message, never in the URL.
 *  - Hints carry no personal data; listeners re-fetch over HTTP. Because events sent while
 *    disconnected are lost, every (re)connect fires a 'resync' so screens catch up once.
 *  - Reconnect: exponential backoff with random jitter (max 30 s). After a server restart
 *    (close 1012) the first retry waits a random 1-10 s, so a deploy does not cause every app
 *    to reconnect and re-fetch at the same moment.
 *  - Unauthorized (4401): stop until the token changes (no retry loop on a bad session).
 */

export type AppEventType = 'stats.changed' | 'payment.updated' | 'maintenance.changed' | 'broadcast.progress' | 'resync';
export interface AppEvent {
  type: AppEventType;
  [key: string]: unknown;
}

type Listener = (e: AppEvent) => void;

const MAX_BACKOFF_MS = 30_000;

function eventsUrl(): string {
  return getBackendBaseUrl().replace(/^http/i, 'ws').replace(/\/+$/, '') + '/events';
}

export class EventsConnection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private wanted = false;
  private blockedToken: string | null = null;
  private hadSession = false;

  constructor(private readonly getAuth: () => { token?: string | null; adminToken?: string | null }) {}

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Connect if possible (signed in, not blocked). Safe to call repeatedly. */
  start() {
    this.wanted = true;
    if (this.ws || this.retryTimer) return;
    this.connect();
  }

  /** Close and stop reconnecting (hidden / background / signed out). */
  stop() {
    this.wanted = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        ws.close(1000, 'not needed');
      } catch {}
    }
  }

  private credential(): string | null {
    const a = this.getAuth();
    return a.adminToken || a.token || null;
  }

  private connect() {
    const auth = this.getAuth();
    const cred = auth.adminToken || auth.token;
    if (!this.wanted || !cred || cred === this.blockedToken) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(eventsUrl());
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(auth.adminToken ? { type: 'auth', adminToken: auth.adminToken } : { type: 'auth', token: auth.token }));
      } catch {}
    };
    ws.onmessage = (msg) => {
      let event: AppEvent | null = null;
      try {
        event = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (!event || typeof event.type !== 'string') return;
      if ((event.type as string) === 'ready') {
        this.attempt = 0;
        // Catch up on anything missed while disconnected (not needed on the very first connect:
        // screens load their data when they mount).
        if (this.hadSession) this.emit({ type: 'resync' });
        this.hadSession = true;
        return;
      }
      this.emit(event);
    };
    ws.onclose = (ev) => {
      if (this.ws === ws) this.ws = null;
      if (!this.wanted) return;
      if (ev.code === 4401) {
        // Bad / expired session: wait for a new token instead of hammering the server
        this.blockedToken = cred;
        return;
      }
      this.scheduleRetry(ev.code === 1012 ? 1000 + Math.random() * 9000 : undefined);
    };
    ws.onerror = () => undefined;
  }

  private scheduleRetry(firstDelayMs?: number) {
    if (!this.wanted || this.retryTimer) return;
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt);
    const delay = firstDelayMs ?? base / 2 + Math.random() * (base / 2); // jitter
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  /** The token changed (sign in / refresh): allow connecting again. */
  credentialChanged() {
    const cred = this.credential();
    if (cred && cred !== this.blockedToken) this.blockedToken = null;
    if (!cred) {
      this.stop();
      this.wanted = true; // keep intent; connect again when a token appears
      return;
    }
    if (this.wanted && !this.ws && !this.retryTimer) this.connect();
  }

  private emit(e: AppEvent) {
    for (const l of [...this.listeners]) {
      try {
        l(e);
      } catch {}
    }
  }
}

/**
 * Keeps a connection open only while the app is visible / in the foreground.
 * Returns a cleanup function.
 */
export function bindToVisibility(conn: EventsConnection): () => void {
  const isVisible = () =>
    Platform.OS === 'web'
      ? typeof document === 'undefined' || document.visibilityState === 'visible'
      : AppState.currentState === 'active';
  const sync = () => (isVisible() ? conn.start() : conn.stop());
  sync();

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => conn.stop());
    return () => {
      document.removeEventListener('visibilitychange', sync);
      conn.stop();
    };
  }
  const sub = AppState.addEventListener('change', sync);
  return () => {
    sub.remove();
    conn.stop();
  };
}
