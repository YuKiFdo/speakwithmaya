import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, type UserProfileData } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * TEMPORARY diagnostic (perf audit 2026-11-17): finds which users generate
 * excessive authenticated traffic (e.g. the /v1/auth/me storm).
 * Counts requests per user per 60 s window and logs only users above
 * AUTH_RATE_LOG_THRESHOLD (default 30/min). Disable with AUTH_RATE_LOG=0.
 * Remove once the client-side loop is fixed.
 */
const rateLogger = new Logger('AuthRateMonitor');
const RATE_LOG_ENABLED = process.env.AUTH_RATE_LOG !== '0';
const RATE_LOG_THRESHOLD = Number(process.env.AUTH_RATE_LOG_THRESHOLD) || 30;
const RATE_LOG_MAX_USERS = 5000;

interface UserCallStats {
  total: number;
  paths: Map<string, number>;
  ua: string;
}

const callStats = new Map<string, UserCallStats>();

function recordAuthCall(userId: string, request: any): void {
  if (!RATE_LOG_ENABLED || !userId) return;
  let stats = callStats.get(userId);
  if (!stats) {
    if (callStats.size >= RATE_LOG_MAX_USERS) return;
    stats = { total: 0, paths: new Map(), ua: String(request.headers?.['user-agent'] || '').slice(0, 120) };
    callStats.set(userId, stats);
  }
  stats.total++;
  const path = String(request.originalUrl || request.url || '').split('?')[0];
  stats.paths.set(path, (stats.paths.get(path) || 0) + 1);
}

if (RATE_LOG_ENABLED) {
  setInterval(() => {
    for (const [userId, stats] of callStats) {
      if (stats.total < RATE_LOG_THRESHOLD) continue;
      const topPaths = [...stats.paths.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p, n]) => `${p}=${n}`)
        .join(' ');
      rateLogger.warn(`user=${userId} calls/min=${stats.total} top=[${topPaths}] ua="${stats.ua}"`);
    }
    callStats.clear();
  }, 60_000).unref();
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Invalid Bearer token');
    }

    const userId = this.authService.validateAuthToken(token);
    recordAuthCall(userId, request);
    const user = await this.loadProfile(userId, request);

    if (!user) {
      throw new UnauthorizedException('User account does not exist or has been deactivated');
    }

    // Attach validated database user profile to the request
    request.user = user;
    return true;
  }

  /**
   * Per-user profile cache (5 s TTL, single-flight: concurrent calls share one DB read).
   *
   * Every authenticated request used to run getProfile() (1-4 sequential DB round trips to
   * Singapore), so a dashboard load firing ~8 requests paid that ~8 times over.
   * - Cached: all GET requests, plus tracking POSTs that only need the user id
   *   (users/event, users/step, promotions/comeback-ping).
   * - Always fresh: every other write (session finish, payments, promotions claim, settings...),
   *   because handlers may use request.user (e.g. minutes balance) to compute the write.
   * - Any write except the pure-analytics ones clears the user's entry, so their next read
   *   reflects the change (staleness is bounded by the 5 s TTL otherwise).
   */
  private async loadProfile(userId: string, request: any): Promise<UserProfileData> {
    const method = String(request.method || 'GET').toUpperCase();
    const path = String(request.originalUrl || request.url || '').split('?')[0];
    const isRead = method === 'GET' || method === 'HEAD';
    const isTrackingWrite = TRACKING_WRITE_RE.test(path);

    if (!isRead && method !== 'OPTIONS' && !ANALYTICS_ONLY_RE.test(path)) {
      // users/step changes profile fields; it may still use a cached profile for its own guard
      // check below, but the next read must refetch.
      const cachedForStep = isTrackingWrite ? profileCache.get(userId)?.value : undefined;
      profileCache.delete(userId);
      if (cachedForStep) return cachedForStep;
    }
    if (!isRead && !isTrackingWrite) {
      return this.authService.getProfile(userId);
    }

    const now = Date.now();
    const cached = profileCache.get(userId);
    if (cached) {
      if (cached.value && cached.expiresAt > now) return cached.value;
      if (cached.inFlight) return cached.inFlight;
    }

    const inFlight = this.authService.getProfile(userId);
    if (profileCache.size >= PROFILE_CACHE_MAX && !profileCache.has(userId)) {
      // Bounded: evict the oldest entry (Map preserves insertion order)
      const oldest = profileCache.keys().next().value;
      if (oldest !== undefined) profileCache.delete(oldest);
    }
    profileCache.set(userId, { inFlight, expiresAt: 0 });
    try {
      const value = await inFlight;
      profileCache.set(userId, { value, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
      return value;
    } catch (err) {
      profileCache.delete(userId);
      throw err;
    }
  }
}

/** POSTs whose handlers only need the user id (fire-and-forget tracking writes). */
const TRACKING_WRITE_RE = /\/v1\/(users\/event|users\/step|promotions\/comeback-ping)\/?$/;
/** Writes that never change profile data, so they do not invalidate the cache. */
const ANALYTICS_ONLY_RE = /\/v1\/(users\/event|promotions\/comeback-ping)\/?$/;
const PROFILE_CACHE_TTL_MS = 5_000;
const PROFILE_CACHE_MAX = 5_000;
const profileCache = new Map<
  string,
  { value?: UserProfileData; inFlight?: Promise<UserProfileData>; expiresAt: number }
>();
