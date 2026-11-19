import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { EventsService } from './events.service.js';

/** Unauthenticated sockets are closed after this long. */
const AUTH_DEADLINE_MS = 5_000;
/** Ping every 25 s: under Cloudflare's 100 s idle cut-off and nginx's read timeout. */
const HEARTBEAT_MS = 25_000;
/** Re-validate the login token this often (expiry / logout revocation). */
const REVALIDATE_MS = 5 * 60_000;
/** Max open event sockets per user (tabs/devices); the oldest is closed beyond this. */
const MAX_PER_USER = 5;
/** Hard cap for the whole process, so this channel can never starve live calls. */
const MAX_TOTAL = 10_000;
/** Clients only ever send the small auth message. */
const MAX_MESSAGE_BYTES = 4 * 1024;

const CLOSE = {
  unauthorized: 4401,
  authTimeout: 4408,
  tooMany: 4429,
  restarting: 1012, // "Service Restart": clients reconnect with jitter
  badMessage: 1009,
};

/** Same origins as the HTTP CORS allowlist (main.ts). Native apps send no Origin header. */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return (
    [
      'https://admin.speakwithmaya.com',
      'https://speakwithmaya.com',
      'https://www.speakwithmaya.com',
    ].includes(origin) ||
    origin.endsWith('.speakwithmaya.com') ||
    origin.includes('azurecontainerapps.io') ||
    origin.includes('azurewebsites.net') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)
  );
}

interface ClientState {
  userId?: string;
  isAdmin?: boolean;
  token?: string;
  alive: boolean;
  authTimer?: ReturnType<typeof setTimeout>;
  connectedAt: number;
  lastValidatedAt: number;
}

/**
 * /events: lightweight server -> client change hints (see EventsService).
 * Kept separate from /live-session and does no heavy work, so it cannot slow calls down.
 *
 * Protocol:
 *   client -> {"type":"auth","token":"<user JWT>"}  or  {"type":"auth","adminToken":"<admin token>"}
 *   server -> {"type":"ready"}  then hints like {"type":"stats.changed"}
 * The token is never put in the URL (URLs end up in proxy logs).
 */
@WebSocketGateway({ path: '/events' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(
    private readonly authService: AuthService,
    private readonly events: EventsService,
  ) {
    this.heartbeat = setInterval(() => this.tick(), HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  handleConnection(client: WebSocket, req?: IncomingMessage) {
    const origin = req?.headers?.origin as string | undefined;
    if (!isAllowedOrigin(origin)) {
      client.close(CLOSE.unauthorized, 'origin');
      return;
    }
    if (this.clients.size >= MAX_TOTAL) {
      client.close(CLOSE.tooMany, 'busy');
      return;
    }

    const state: ClientState = { alive: true, connectedAt: Date.now(), lastValidatedAt: 0 };
    state.authTimer = setTimeout(() => {
      if (!state.userId && !state.isAdmin) client.close(CLOSE.authTimeout, 'auth timeout');
    }, AUTH_DEADLINE_MS);
    this.clients.set(client, state);

    client.on('pong', () => {
      state.alive = true;
    });
    client.on('message', (data: any, isBinary?: boolean) => this.onMessage(client, state, data, isBinary));
    client.on('error', () => undefined);
  }

  handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    if (!state) return;
    if (state.authTimer) clearTimeout(state.authTimer);
    this.events.unregister(client, state.userId);
    this.clients.delete(client);
  }

  private onMessage(client: WebSocket, state: ClientState, data: any, isBinary?: boolean) {
    const size = typeof data?.length === 'number' ? data.length : 0;
    if (isBinary || size > MAX_MESSAGE_BYTES) {
      client.close(CLOSE.badMessage, 'bad message');
      return;
    }
    let msg: any;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg?.type !== 'auth' || state.userId || state.isAdmin) return;

    try {
      if (typeof msg.adminToken === 'string' && msg.adminToken) {
        if (!this.authService.validateAdminToken(msg.adminToken)) throw new Error('bad admin token');
        state.isAdmin = true;
        state.token = msg.adminToken;
      } else if (typeof msg.token === 'string' && msg.token) {
        state.userId = this.authService.validateAuthToken(msg.token);
        state.token = msg.token;
      } else {
        throw new Error('no token');
      }
    } catch {
      client.close(CLOSE.unauthorized, 'unauthorized');
      return;
    }

    if (state.authTimer) clearTimeout(state.authTimer);
    state.lastValidatedAt = Date.now();

    // Per-user cap: close the oldest extra socket (old tab / stale device)
    if (state.userId) {
      const existing = this.events.socketsOf(state.userId);
      if (existing && existing.size >= MAX_PER_USER) {
        const oldest = [...existing].sort(
          (a, b) => (this.clients.get(a)?.connectedAt || 0) - (this.clients.get(b)?.connectedAt || 0),
        )[0];
        oldest?.close(CLOSE.tooMany, 'too many connections');
      }
    }
    this.events.register(client, { userId: state.userId, isAdmin: state.isAdmin });
    try {
      client.send(JSON.stringify({ type: 'ready' }));
    } catch {}
  }

  /** Heartbeat + periodic token re-validation (expired / logged-out tokens are dropped). */
  private tick() {
    const now = Date.now();
    for (const [client, state] of this.clients) {
      if (!state.alive) {
        try {
          client.terminate();
        } catch {}
        continue;
      }
      state.alive = false;
      try {
        client.ping();
      } catch {}

      if (state.token && now - state.lastValidatedAt > REVALIDATE_MS) {
        state.lastValidatedAt = now;
        try {
          const ok = state.isAdmin
            ? this.authService.validateAdminToken(state.token)
            : Boolean(this.authService.validateAuthToken(state.token));
          if (!ok) throw new Error('invalid');
        } catch {
          client.close(CLOSE.unauthorized, 'session expired');
        }
      }
    }
  }

  /** Deploy / restart: tell clients to reconnect (they add random delay to avoid a stampede). */
  onApplicationShutdown() {
    clearInterval(this.heartbeat);
    for (const client of this.clients.keys()) {
      try {
        client.close(CLOSE.restarting, 'restarting');
      } catch {}
    }
    this.logger.log(`[Events] closed ${this.clients.size} sockets for shutdown`);
  }
}
