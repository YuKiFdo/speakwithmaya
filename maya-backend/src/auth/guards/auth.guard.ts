import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
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
    const user = await this.authService.getProfile(userId);

    if (!user) {
      throw new UnauthorizedException('User account does not exist or has been deactivated');
    }

    // Attach validated database user profile to the request
    request.user = user;
    return true;
  }
}
