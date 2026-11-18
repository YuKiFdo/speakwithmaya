import { AsyncLocalStorage } from 'node:async_hooks';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Logger } from '@nestjs/common';

/**
 * Lightweight production diagnostics (perf audit 2026-11-18).
 *
 * Answers "why was this request slow?" without a profiler:
 * - every request gets a context (AsyncLocalStorage) that counts its outbound HTTP calls
 *   (Supabase, Gemini, storage...) and the total/max time spent waiting on them;
 * - requests slower than SLOW_REQUEST_MS are logged with that breakdown, so we can tell
 *   "waiting on the database" (high out_ms) from "stuck behind the event loop" (low out_ms);
 * - event-loop delay is sampled continuously and logged once a minute when it is high,
 *   which reveals CPU-bound work blocking every request.
 *
 * Overhead: one small object per request and a counter per outbound call.
 * Disable with REQUEST_DIAGNOSTICS=0; tune with SLOW_REQUEST_MS (default 1500).
 */
interface RequestStats {
  outCalls: number;
  outMs: number;
  outMaxMs: number;
  outHosts: Map<string, number>;
}

const logger = new Logger('RequestDiagnostics');
const ENABLED = process.env.REQUEST_DIAGNOSTICS !== '0';
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS) || 1500;
const store = new AsyncLocalStorage<RequestStats>();

/** Wraps a fetch so calls made while handling a request are attributed to that request. */
export function instrumentFetch(fetchImpl: typeof fetch): typeof fetch {
  if (!ENABLED) return fetchImpl;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const stats = store.getStore();
    if (!stats) return fetchImpl(input, init);
    const started = performance.now();
    try {
      return await fetchImpl(input, init);
    } finally {
      const ms = performance.now() - started;
      stats.outCalls++;
      stats.outMs += ms;
      if (ms > stats.outMaxMs) stats.outMaxMs = ms;
      let host = 'unknown';
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        host = new URL(url).hostname.split('.')[0] || host;
      } catch {}
      stats.outHosts.set(host, (stats.outHosts.get(host) || 0) + 1);
    }
  }) as typeof fetch;
}

/** Express middleware: opens the per-request context and logs slow requests on finish. */
export function requestDiagnosticsMiddleware(req: any, res: any, next: () => void): void {
  if (!ENABLED) return next();
  const stats: RequestStats = { outCalls: 0, outMs: 0, outMaxMs: 0, outHosts: new Map() };
  const started = performance.now();
  res.on('finish', () => {
    const totalMs = performance.now() - started;
    if (totalMs < SLOW_REQUEST_MS) return;
    const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/[0-9a-f-]{20,}/gi, ':id');
    const hosts = [...stats.outHosts.entries()].map(([h, n]) => `${h}=${n}`).join(',');
    logger.warn(
      `[SlowRequest] ${req.method} ${path} ${res.statusCode} total=${Math.round(totalMs)}ms ` +
        `out_calls=${stats.outCalls} out_ms=${Math.round(stats.outMs)} out_max=${Math.round(stats.outMaxMs)}ms ` +
        `other_ms=${Math.round(Math.max(0, totalMs - stats.outMs))} hosts=[${hosts}]`,
    );
  });
  store.run(stats, next);
}

/** Logs event-loop delay once a minute when it is high (blocked loop = every request waits). */
export function startEventLoopMonitor(): void {
  if (!ENABLED) return;
  const h = monitorEventLoopDelay({ resolution: 20 });
  h.enable();
  setInterval(() => {
    const p99 = h.percentile(99) / 1e6;
    const max = h.max / 1e6;
    if (p99 > 100 || max > 500) {
      logger.warn(
        `[EventLoopDelay] last 60s p50=${(h.percentile(50) / 1e6).toFixed(0)}ms p99=${p99.toFixed(0)}ms max=${max.toFixed(0)}ms`,
      );
    }
    h.reset();
  }, 60_000).unref();
}
