import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGuard } from './auth.guard.js';

function makeContext(method: string, url: string, token = 'tok') {
  const request: any = { method, originalUrl: url, headers: { authorization: `Bearer ${token}` } };
  return {
    request,
    ctx: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
  };
}

describe('AuthGuard profile cache', () => {
  let getProfile: ReturnType<typeof vi.fn>;
  let guard: AuthGuard;
  let userSeq = 0;
  let userId: string;

  beforeEach(() => {
    userId = `user-${++userSeq}`; // module-level cache: isolate each test by user id
    getProfile = vi.fn(async (id: string) => ({ id, minutes_balance: 10 }));
    const authService: any = { validateAuthToken: () => userId, getProfile };
    const reflector: any = { getAllAndOverride: () => false };
    guard = new AuthGuard(authService, reflector);
  });

  it('dedupes concurrent GET /v1/auth/me into one DB read', async () => {
    const calls = Array.from({ length: 20 }, () => {
      const { ctx } = makeContext('GET', '/v1/auth/me');
      return guard.canActivate(ctx);
    });
    await Promise.all(calls);
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('serves repeat /auth/me from cache within the TTL', async () => {
    await guard.canActivate(makeContext('GET', '/v1/auth/me').ctx);
    await guard.canActivate(makeContext('GET', '/v1/auth/me?x=1').ctx);
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('always reads fresh for other routes', async () => {
    await guard.canActivate(makeContext('GET', '/v1/sessions').ctx);
    await guard.canActivate(makeContext('GET', '/v1/sessions').ctx);
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it('invalidates the cached profile after a mutating request', async () => {
    await guard.canActivate(makeContext('GET', '/v1/auth/me').ctx);
    await guard.canActivate(makeContext('POST', '/v1/users/step').ctx);
    await guard.canActivate(makeContext('GET', '/v1/auth/me').ctx);
    expect(getProfile).toHaveBeenCalledTimes(3);
  });

  it('does not cache failures', async () => {
    getProfile.mockRejectedValueOnce(new Error('db down'));
    await expect(guard.canActivate(makeContext('GET', '/v1/auth/me').ctx)).rejects.toThrow('db down');
    await guard.canActivate(makeContext('GET', '/v1/auth/me').ctx);
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it('attaches the profile to request.user', async () => {
    const { ctx, request } = makeContext('GET', '/v1/auth/me');
    await guard.canActivate(ctx);
    expect(request.user).toEqual({ id: userId, minutes_balance: 10 });
  });
});
