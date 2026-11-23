import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 signing for Maya user and admin tokens.
 *
 * Production has no JWT_SECRET and signs with SUPABASE_SECRET_KEY, so this order keeps existing
 * tokens valid. There is deliberately no hardcoded fallback: verifiers used to also accept a
 * public constant secret, which let anyone forge a token for any user.
 */
export function tokenSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Token secret missing: set JWT_SECRET or SUPABASE_SECRET_KEY');
  return secret;
}

export function signTokenParts(header: string, payload: string): string {
  return createHmac('sha256', tokenSecret()).update(`${header}.${payload}`).digest('base64url');
}

/** Constant-time check (a plain === leaks how many leading characters matched). */
export function hasValidTokenSignature(header: string, payload: string, signature: string): boolean {
  const expected = Buffer.from(signTokenParts(header, payload));
  const given = Buffer.from(signature || '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
