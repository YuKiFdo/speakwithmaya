import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasValidTokenSignature, signTokenParts } from './token-signature.js';

const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');

describe('token signature', () => {
  const saved = { jwt: process.env.JWT_SECRET, supa: process.env.SUPABASE_SECRET_KEY };

  beforeEach(() => {
    delete process.env.JWT_SECRET;
    process.env.SUPABASE_SECRET_KEY = 'server-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = saved.jwt;
    process.env.SUPABASE_SECRET_KEY = saved.supa;
    if (saved.jwt === undefined) delete process.env.JWT_SECRET;
    if (saved.supa === undefined) delete process.env.SUPABASE_SECRET_KEY;
  });

  it('accepts a token it signed (SUPABASE_SECRET_KEY when JWT_SECRET is unset, as in production)', () => {
    expect(hasValidTokenSignature(header, payload, signTokenParts(header, payload))).toBe(true);
  });

  it('rejects a token signed with the old public fallback secret', () => {
    const forged = createHmac('sha256', 'maya-secure-jwt-secret').update(`${header}.${payload}`).digest('base64url');
    expect(hasValidTokenSignature(header, payload, forged)).toBe(false);
  });

  it('rejects a tampered payload and a malformed signature', () => {
    const sig = signTokenParts(header, payload);
    const otherPayload = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');
    expect(hasValidTokenSignature(header, otherPayload, sig)).toBe(false);
    expect(hasValidTokenSignature(header, payload, 'short')).toBe(false);
    expect(hasValidTokenSignature(header, payload, '')).toBe(false);
  });

  it('prefers JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const sig = createHmac('sha256', 'jwt-secret').update(`${header}.${payload}`).digest('base64url');
    expect(hasValidTokenSignature(header, payload, sig)).toBe(true);
  });

  it('refuses to sign or verify without any secret', () => {
    delete process.env.SUPABASE_SECRET_KEY;
    expect(() => signTokenParts(header, payload)).toThrow(/Token secret missing/);
  });
});
