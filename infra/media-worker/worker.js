/**
 * media.speakwithmaya.com -> private R2 bucket in another Cloudflare account.
 *
 * The domain lives in one Cloudflare account and the R2 bucket in another, and R2 custom
 * domains only work within one account. This Worker (deployed in the domain's account)
 * reads objects from the bucket over the S3 API with a READ-ONLY R2 token, caches them at
 * the edge, and adds CORS headers for the web app.
 *
 * Worker settings -> Variables and Secrets:
 *   R2_ACCOUNT_ID        (text)   account ID that owns the bucket
 *   R2_BUCKET            (text)   e.g. maya-media
 *   R2_ACCESS_KEY_ID     (secret) R2 token with Object Read only, scoped to the bucket
 *   R2_SECRET_ACCESS_KEY (secret)
 *
 * Plain JavaScript (Web Crypto), no dependencies: paste into the dashboard editor.
 */

const ALLOWED_PREFIXES = ['session-recordings/', 'roadmap-audio/'];
const ALLOWED_ORIGINS = [
  'https://app.speakwithmaya.com',
  'https://admin.speakwithmaya.com',
  'https://speakwithmaya.com',
  'https://www.speakwithmaya.com',
];
const CACHE_SECONDS = 60 * 60 * 24 * 30; // objects are write-once, so cache for 30 days

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key || key.includes('..') || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstream = await signedR2Request(env, request.method, key, request.headers.get('Range'));
    const res = await fetch(upstream, {
      // Cache full-object responses at the edge; the R2 URL has no signature in it (we sign
      // with headers), so the cache key is stable across requests.
      cf: request.headers.get('Range') ? undefined : { cacheEverything: true, cacheTtl: CACHE_SECONDS },
    });

    if (res.status === 404 || res.status === 403) {
      // Do not leak S3 error bodies (they name the bucket/account)
      return new Response('Not found', { status: 404, headers: cors });
    }

    const headers = new Headers();
    for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}, immutable`);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);

    return new Response(request.method === 'HEAD' ? null : res.body, { status: res.status, headers });
  },
};

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// ---- AWS Signature V4 for a single S3 GET/HEAD against R2 --------------------------------

async function signedR2Request(env, method, key, range) {
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = '/' + [env.R2_BUCKET, ...key.split('/')].map(encodeRfc3986).join('/');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  const kDate = await hmac(enc('AWS4' + env.R2_SECRET_ACCESS_KEY), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  const headers = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (range) headers.Range = range; // unsigned header: allowed by SigV4

  return new Request(`https://${host}${path}`, { method, headers });
}

function encodeRfc3986(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
const enc = (s) => new TextEncoder().encode(s);
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(s) {
  return toHex(await crypto.subtle.digest('SHA-256', enc(s)));
}
async function hmac(keyBytes, msg) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc(msg));
}
