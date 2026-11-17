# SpeakWithMaya: Production Performance Audit

**Date:** 2026-11-17. Collection window 17:31–17:50 UTC; log coverage 03:48–17:45 UTC.
**Host:** OVH VPS `vps-3939228d`, 2 vCPU, 3.8 GB RAM, no swap.
**Mode:** Read-only. Nothing on the VPS was changed, with one exception, disclosed in §11.
**Evidence labels:** **Confirmed** (measured), **Likely** (strong indirect evidence), **Unproven** (plausible but not measured), **Unrelated**.

---

## 1. Executive summary

The slowness comes from **a flood of `GET /v1/auth/me` calls hitting a backend that does two to three uncached Supabase (HTTPS) round trips per call**. The VPS also loses 15–27% of its CPU to OVH steal at the same times. When Supabase or the event loop slows down, requests queue for up to Nginx's 120 s timeout and come back as 504s. Clients then fire even more `/auth/me` calls, a restart refuses everything for a few seconds, and the cycle repeats.

`/v1/auth/me` is **17,499 of 32,559 requests today (54%)**, plus 6,102 CORS preflights for it. **Two browsers account for about 20,000 of these**, and one of them peaked at **274 calls in a single second**.

The reported 100–120% CPU is **not happening right now**. The backend averaged about 20% in a live 60 s sample at 17:31 UTC. sar does show the box saturated (idle 0–20%) from **15:30 to 17:00 UTC**, which matches the `/auth/me` peak hours and the 504 storm.

**Top 3 causes (confidence)**
1. **Client-side `/auth/me` request storm.** Volume and its correlation with the outage: **Confirmed**. Exact frontend trigger: **Likely**.
2. **An expensive, uncached auth path.** Every authenticated request runs `SELECT * FROM profiles` through Supabase (sometimes with an auto-heal write), and `/auth/me` adds an uncached app-config fetch plus `JSON.parse`. Fan-out: **Confirmed** from source. CPU share: **Likely**.
3. **Side load during the same window**: OVH steal of 15–27% (**Confirmed**), `@nestjs/observe` tracing on every request while over quota (**Confirmed** 429s, overhead **Likely**), 705 failed Azure uploads to a disabled storage account (**Confirmed**), and very verbose per-packet Live logging (**Confirmed**).

**Overall confidence:** high that the auth flood plus the uncached guard drive the 15:30–17:00 incident. Medium on the exact CPU split, because there is no CPU profile (§11).

---

## 2. Infrastructure findings

| Metric | Evidence | Finding |
|---|---|---|
| CPU, live | `mpstat -P ALL 5 12`, 17:31:45–17:32:45 | usr 11.9%, sys 2.4%, **steal 5.2% avg, up to 19% in a 5 s sample** (`vmstat`), idle 80%. Both cores balanced. **Not constrained now.** |
| CPU, history | `sar -u` for today | **15:30–17:00: idle 0.09–21%, steal 6.7–27%.** 16:00 and 16:10 were 0.09% idle with 26–27% steal. Since 17:10 idle is 75–81%. **Confirmed saturation during the incident.** |
| Steal | sar | 9.6% daily average, peaks at 27%. **Confirmed contributor.** On 2 vCPU, a quarter of the CPU taken by the hypervisor is significant. |
| Memory | `free -m` | 1.3 GB used, 2.5 GB available, no swap. **Not a factor.** |
| Disk | `iostat -x`, `df` | iowait about 0.03%, `%util` under 1%, 15% used. **Not a factor (Unrelated).** |
| Load | `uptime` | 0.91 / 0.67 / 0.82 now. |
| Other processes | `pidstat` | frontend web-server about 4%, next-server about 5%, PM2 God about 3.8%. Nothing unrelated is heavy. |
| Network exposure | `ss -ltn` | **:3000, :3001 and :8080 listen on 0.0.0.0**, so they can be reached directly and bypass Nginx (whether a firewall blocks them was not checked). **:9229 Node inspector listens on 127.0.0.1.** |

## 3. Backend findings

### Process behaviour (PM2)
`/home/ubuntu/.pm2/dump.pm2` (environment fields excluded) and `ecosystem.config.cjs`:

| App | Mode | Instances | Restarts | Started (UTC) |
|---|---|---|---|---|
| maya-backend | cluster_mode | 1 | 20 | 16:20:58 |
| maya-frontend | cluster_mode | 1 | 0 | 16:21:19 |
| maya-landing (next :3001) | cluster_mode | 1 | 243 | 03:48:18 |

- **Only one backend instance**, so crons and timers do not run twice. **Confirmed.**
- **19 backend starts today** (`Nest application successfully started` in `maya-backend-out-2.log`): 13 between 03:50 and 08:19, then 11:32, 14:44, 16:17 and 16:22. Each restart caused bursts of `connect() failed (111: Connection refused)` in Nginx (**1,162 in total**: 182 at 11:30, 721 at 16:20). Many are probably deploys; the 16:17 and 16:22 restarts follow directly on the 15:30–16:00 timeout storm. **Confirmed** restart-refusal cost; the cause of each restart is **Unproven**.
- **maya-landing: 243 restarts**, plus `Failed to find Server Action` errors in its error log. **Likely Unrelated** to backend CPU, but worth separate investigation.
- **Inspector:** the backend error log contains `Debugger ending on ws://127.0.0.1:9229/…`, and PID 95875 owns no inspector flag in PM2 `node_args` or the ecosystem file. Something activated the inspector at runtime (a manual `SIGUSR1`, or a tool or agent). **Confirmed** that it was active; the source is **Unproven**. It is a security risk, and an attached debugger slows execution.

### CPU and event loop
- **No CPU profile or event-loop metrics were captured.** The inspector attach was not approved (§11).
- Static hot-path analysis:
  - **`AuthGuard.canActivate`** ([auth.guard.ts:40-41](maya-backend/src/auth/guards/auth.guard.ts#L40-L41)) calls `authService.getProfile(userId)` on **every authenticated request**. That is an uncached Supabase `select('*')` on `profiles` ([auth.service.ts:1517-1522](maya-backend/src/auth/auth.service.ts#L1517-L1522)), with an **auto-heal write path** at lines 1538+.
  - **`getMe`** ([auth.controller.ts:75-85](maya-backend/src/auth/auth.controller.ts#L75-L85)) adds `isTestAccount()`, which calls `getAppConfig()` ([auth.service.ts:1659](maya-backend/src/auth/auth.service.ts#L1659), [3207-3216](maya-backend/src/auth/auth.service.ts#L3207-L3216)). That is another uncached Supabase query plus `JSON.parse(canonical_content)`, a large settings blob, on every call.
  - So each `/auth/me` costs **2–3 HTTPS round trips to Supabase, TLS and JSON decoding, a JSON parse of app config, and Observe trace bookkeeping**. At 274 req/s from one client, that alone exceeds what one Node thread on a stolen-CPU 2-vCPU VM can serve.
  - **Live gateway packet tracing** ([live.gateway.ts:1425-1450](maya-backend/src/live/live.gateway.ts#L1425-L1450)) builds strings and **base64-decodes audio to measure its byte length** for every greeting packet. That produced about 855 `keys=[…]` lines and thousands of `Greeting Packet` lines in `maya-backend-out-2.log` (11,188 lines, 2 MB since 03:48). **Confirmed** as log volume; CPU impact **Likely** small to medium.

## 4. API performance

Source: `/var/log/nginx/access.log`, 32,559 lines, 03:52–17:45 UTC.

**Top endpoints:** `GET /v1/auth/me` 17,499 · `OPTIONS /v1/auth/me` 6,102 · `GET /v1/app-config` 2,645 · `GET/OPTIONS /v1/sessions` 978 · `GET/OPTIONS /v1/roadmap/user-progress` 789.

**Status:** 304 11,280 · 200 8,727 · 204 6,450 · **504 2,240 · 502 1,495 · 499 866**.

**Failures by endpoint:** `/v1/auth/me` 504 ×1,889, 502 ×1,166, 499 ×597. Then `/v1/app-config` (174 / 103 / 69) and `/v1/sessions`.

**Nginx error log, by kind:** `upstream timed out` 2,240 · `connection refused` 1,162 · `connection reset` 318.

**Timeouts per 10 min:** 12:20 → 187 · **15:30 → 361 · 15:40 → 1,119 · 15:50 → 122** · 16:00 → 55 · 16:20 → 201 (plus 721 refused).

**Request volume per hour vs CPU (sar):**

| Hour UTC | All requests | `/auth/me` | sar idle |
|---|---|---|---|
| 07 | 6,807 | 6,029 | n/a (pre-reboot sar file) |
| 12 | 2,692 | 1,630 | timeouts at 12:20 |
| 14 | 617 | 0 | 52–82% |
| **15** | 3,905 | **3,125** | **7.8–70%** |
| **16** | 8,832 | **8,214** | **0.09–49%** |
| 17 | 286 | 141 | 75–81% |

**Bottlenecks:**
1. **The API location uses `proxy_read_timeout 120s`.** A stuck `/auth/me` holds a connection and a client promise for two minutes before returning a 504. That is a **waiting** cost (DB, external call or queueing), not CPU time. **Confirmed** from config plus the 2,240 timeouts.
2. **There is no `$request_time` or `$upstream_response_time` in the log format** (`access_log /var/log/nginx/access.log;` uses the default `combined` format). **Per-request latency cannot be measured.** This is missing instrumentation, and §10 proposes a format.
3. **CORS preflights:** 6,102 `OPTIONS /v1/auth/me`. There is no `Access-Control-Max-Age` caching evidence (not verified in code), so the browser re-preflights constantly.

## 5. Database findings

- **The DB is Supabase, reached over HTTPS through `supabase-js`.** There is no Postgres on the VPS and no 5432/6543 sockets (`ss`). That explains why the reported errors are "fetch" failures rather than Postgres pool errors. **Confirmed.**
- **Pool and connection stats (`pg_stat_activity`, `pg_stat_statements`, locks): not measured.** No read-only DB role was provided. In Supabase, these are under **Dashboard → Database → Query Performance**, which reads `pg_stat_statements`.
- Only **2 `fetch failed`/`ETIMEDOUT`-type lines** are in the current backend error log (both around 16:xx). The **"PostgreSQL fetch failures" symptom is not reproduced in today's logs.** **Unproven**: it may have been in logs that have since rotated.
- **Repeated queries per request (from source):** `/auth/me` runs `profiles select *` (guard) plus `roadmap_levels` (`sys_app_settings`) (app config), and possibly a `profiles` update (auto-heal). Every other authenticated endpoint repeats the guard's profile query. **Confirmed** from static analysis.
- **Index candidates:** `profiles.id` is presumably the primary key and `roadmap_levels.id` a lookup by id, so no index gap is evident. They cannot be checked without DB access.

## 6. Frontend findings

All call sites of `fetchUserProfile()` (→ `GET /v1/auth/me`, [auth-service.ts:292-299](maya-frontend/src/services/auth/auth-service.ts#L292-L299)):

| File:line | Trigger |
|---|---|
| [useRouteGuard.ts:149](maya-frontend/src/hooks/useRouteGuard.ts#L149) | Effect with deps `[segments, isHydrated]` ([line 232](maya-frontend/src/hooks/useRouteGuard.ts#L232)). It fires on **every navigation** to a guest screen while authenticated, then calls `router.replace` both at line 159 (after the fetch) and at line 169 (immediately). That is **two replaces per run**, and each replace changes `segments` and re-runs the effect. |
| [dashboard.tsx:292](maya-frontend/src/app/(tabs)/dashboard.tsx#L292) | Mount effect. |
| [dashboard.tsx:368](maya-frontend/src/app/(tabs)/dashboard.tsx#L368) | Pro-pass-expired check, a second call on the same mount. |
| [dashboard.tsx:608](maya-frontend/src/app/(tabs)/dashboard.tsx#L608) | Pull-to-refresh. |
| [account.tsx:259](maya-frontend/src/app/(tabs)/account.tsx#L259) | Mount. |
| [useUserStats.ts:270](maya-frontend/src/hooks/useUserStats.ts#L270) | `refreshStats`. Has in-flight dedup (`inFlightRefreshPromise`), but only within itself. |
| [OutageApologyBanner.tsx:101](maya-frontend/src/components/ui/OutageApologyBanner.tsx#L101) | After a promotion claim. |
| [auth-service.ts:217](maya-frontend/src/services/auth/auth-service.ts#L217) | After saving preferences. |
| [personalized-plan.tsx:271, 562, 609](maya-frontend/src/app/onboarding/personalized-plan.tsx#L271) | Onboarding. |

- **`fetchUserProfile()` has no dedup, cache, TTL or backoff.** Concurrent callers each send a request. **Confirmed** from source.
- **A feedback loop exists.** Each success calls `OnboardingStore.setAuthSession()`, which notifies every subscriber, re-renders, and can re-run mount effects and the route guard, which call `fetchUserProfile()` again. **Likely** mechanism.
- **Logs show a loop, not normal use.** IP `2402:4000:…:ae31` (Edge 129 on Windows) made **10,198** calls with peaks of **274, 258 and 249 per second** at 16:38:39 and 16:21:04–07, right as the backend came back from restart. Its statuses: 4,024 × 200, **1,768 × 504, 1,071 × 502, 535 × 499**. It kept going while every call failed, so there is no backoff. IP `2406:2d40:…:f256` (Edge 157) made 9,969 calls, mostly 304. The trigger shows up even when the server is healthy. **Confirmed** volume; exact render path **Likely** (no browser trace).
- All 23,691 `/auth/me` requests carry referer `https://app.speakwithmaya.com/`, which is the SPA root, consistent with the root/guest-screen guard path at `useRouteGuard.ts:139-170`.
- The 304 responses mean ETag revalidation works, but the request still runs the guard's DB query before the 304 is computed.

## 7. Background jobs

| Job | Location | Frequency | Assessment |
|---|---|---|---|
| Subscription reconciliation | `dist/payments/subscription-reconciliation.service.js:380, 386` | `EVERY_DAY_AT_MIDNIGHT` plus `EVERY_10_MINUTES` | Single instance, so no duplication. No timing correlation with the 15:30 spike (the spike is continuous, not every 10 min). **Unproven** contributor. |
| LiveGateway interval | `dist/live/live.gateway.js:458, 482` | Heartbeat per session | Only during live sessions. **Unproven.** |
| `maya-watchdog.service` (systemd, `cloudflare-watchdog.sh`) | `/home/ubuntu/failover-watchdog` | `curl` health check every `CHECK_INTERVAL` | 0.2% CPU. Its health curl hits `/health` on the backend. **Unrelated** to the CPU load, but it can **flip DNS to Azure** while the backend is timing out. Its failover is worth reviewing. |
| Bucket verification | [sessions.service.ts:385-399](maya-backend/src/sessions/sessions.service.ts#L385-L399), roadmap.service.ts:114 | Memoised, but the memo is **cleared on failure** | `Created Supabase storage bucket "session-recordings"` was logged **267 times** today, so `listBuckets` and `createBucket` are re-run repeatedly. **Confirmed** waste. |
| Roadmap TTS synthesis | RoadmapService | about 600 `Requesting Gemini TTS` lines | Followed by **705 `AzureBlobStorage Upload failed … The specified account is disabled`** errors, so audio is generated and then the upload fails every time. **Confirmed** wasted CPU, network and API cost. |
| System timers | `systemctl list-timers` | sysstat, logrotate, apt | **Unrelated.** |

The `ubuntu` user has no crontab (`crontab -l`, confirmed by the user). `/etc/cron.d` contains only `e2scrub_all`.

## 8. Telemetry findings

- `@nestjs/observe` is enabled ([app.module.ts:20-31](maya-backend/src/app.module.ts#L20-L31)) with `tracesSampleRate` 0.2 by default (the `OBSERVE_SAMPLE_RATE` env value was not read).
- **429s:** **169** `ObserveAgentWorker … Telemetry rate-limited (429) – the account has used its included events for this period (600,080 of 300,000)` errors. That is **2× the quota**, and the worker keeps sending and logging every 5 minutes. **Confirmed.**
- **`OperationTraceRegistry` "No snapshot found for traceId … Cannot end trace step for AuthController#getMe / AuthService#isTestAccount / getPublicAppConfig": 43 errors.** These are trace steps ending after their snapshot was evicted, which happens to **long-running requests** (those hitting the 120 s timeout). **Telemetry is reporting the problem, not causing it.** **Likely.**
- **Overhead:** every `/auth/me` is wrapped in trace steps. At 54% of traffic, `/auth/me` alone almost certainly generated most of the 600k events. Telemetry **adds** CPU and event volume but is **not the root cause**. **Likely.**
- **Security:** [app.module.ts:25-26](maya-backend/src/app.module.ts#L25-L26) hardcodes a **fallback `OBSERVE_APP_KEY`/`OBSERVE_APP_SECRET` in committed source** (values not reproduced here). **Rotate it.**

## 9. Root cause ranking

### Confirmed root causes
| # | Cause | Impact | Evidence |
|---|---|---|---|
| C1 | **`/auth/me` request storm from a small number of browsers, with no client dedup or backoff** | Very high | 17,499 + 6,102 OPTIONS (54% of traffic); 2 IPs ≈ 20k; up to 274/s; the hours with most `/auth/me` calls (15–16) are the saturated hours; it continues through 502/504 responses. |
| C2 | **Uncached per-request profile lookup in `AuthGuard`, plus app-config lookup in `getMe`** | High | Source (§3); the 1,889 `/auth/me` 504s dominate the timeouts. |
| C3 | **Nginx `proxy_read_timeout 120s` with no rate limit, so overload turns into minutes-long queues and timeouts** | High (latency) | 2,240 `upstream timed out`, with 1,119 in the 15:40 bucket alone. |

### Likely contributors
| # | Cause | Impact | Evidence |
|---|---|---|---|
| L1 | OVH CPU steal | Medium–high | sar steal 15–27% during the incident. |
| L2 | Observe tracing over quota (wraps every request, retries 429s) | Medium | 169 × 429, 600k events. |
| L3 | Restarts during load produce refusal bursts, then reconnect storms | Medium | 721 refused at 16:20; 274/s peak at 16:21:04–07. |
| L4 | Disabled Azure storage account: generate, then fail-upload | Low–medium | 705 failures. |
| L5 | Bucket re-verification and verbose Live packet logging | Low | 267 bucket logs; about 2 MB out log. |

### Unproven hypotheses
- **Supabase latency spikes as the trigger** of the 15:30 timeouts. Not measurable without DB stats or a `$upstream_response_time` log. Only 2 `fetch failed` lines exist.
- **An event-loop block** (sync work) at 15:30. Needs a CPU profile or ELU metric.
- **The 10-minute reconciliation cron** as a spike source. No periodicity is visible in the data.
- **What activated the inspector on :9229.**

### Unrelated
Disk I/O, memory, system timers, the landing app (separate investigation), and the watchdog CPU.

**Correlation answers**
- **High CPU vs slow responses:** both, in a loop. The flood plus the uncached guard use CPU, and steal reduces capacity. Slow responses then trigger more client calls.
- **Repeated auth drives CPU:** **yes**, Confirmed by volume and timing.
- **DB timeouts cause pile-ups:** **Likely**. The 120 s waits are waiting, not CPU, but they can't be split without latency logging.
- **Crons cause spikes:** **no evidence**.
- **OVH steal contributes:** **yes, Confirmed**, 15–27%.
- **Several issues at once:** **yes**: C1, C2, C3, L1, L2 and L3 all overlapped at 15:30–16:40.

## 10. Recommended fixes (ordered by impact ÷ effort)

All CPU and latency figures are **estimates**.

| # | Problem | Change | Est. CPU ↓ | Est. latency ↓ | Risk | Effort |
|---|---|---|---|---|---|---|
| 1 | Client storm (C1) | Make `fetchUserProfile()` **single-flight** (share one in-flight promise) with a **10–30 s freshness TTL** and **exponential backoff on 5xx/0**. Callers that need fresh data pass `{force:true}`. | 40–70% of request-driven CPU | Large | Low | S |
| 2 | Guard loop (C1) | In `useRouteGuard`, remove the duplicate `router.replace` (lines 159 vs 169). Fetch at most once per session on guest screens, not on every `segments` change. | Part of #1 | — | Medium (routing) | S |
| 3 | Uncached guard (C2) | **Short in-memory profile cache in `AuthGuard`** (for example 15–30 s, keyed by userId, single-flight, invalidated on profile writes). **Cache `getAppConfig()`** (60 s TTL). Move the auto-heal write out of the read path. | 30–50% | Large | Medium (stale plan/minutes; invalidate on payment and quota writes) | M |
| 4 | Nginx (C3) | `limit_req` per IP on `/v1/auth/me` (for example 5 r/s, burst 10). Set `proxy_read_timeout 30s` for normal APIs, keeping `/live-session` long. Add `Access-Control-Max-Age` for preflights. | Protects capacity | p99 bounded at about 30 s | Low | S |
| 5 | Logging gap | `log_format timed '$remote_addr [$time_local] "$request" $status $body_bytes_sent rt=$request_time urt=$upstream_response_time uct=$upstream_connect_time "$http_user_agent"';` | — | Enables measurement | None | S |
| 6 | Telemetry (L2) | Set `OBSERVE_SAMPLE_RATE` to about 0.02, exclude `/auth/me`, `/health` and `/app-config` from tracing, and stop sending on 429 until the period resets. Remove the hardcoded fallback secret and rotate it. | 5–15% | Small | Low | S |
| 7 | Azure (L4) | Re-enable the storage account, or disable the Azure upload path and skip TTS generation whose upload will fail. | 2–10% | — | Low | S |
| 8 | Bucket (L5) | Don't clear the memo on success; verify once at boot. Gate greeting packet tracing behind a debug flag (no base64 decode). | 1–5% | Small | Low | S |
| 9 | Exposure | Bind apps to `127.0.0.1` (or firewall :3000/:3001/:8080), and find and stop whatever enables the inspector on :9229. | — | — | Low | S |
| 10 | Steal (L1) | Raise steal with OVH, or move to a dedicated-vCPU plan **after** #1–#4 are in place (not instead of them). | — | — | — | — |

## 11. Instrumentation gaps and approvals needed

| Gap | Impact | To unlock |
|---|---|---|
| No CPU profile or event-loop metrics | Cannot confirm hot functions or blocking | **Approval:** a 30 s CPU profile through an SSH tunnel to the existing 127.0.0.1:9229 (no restart; under 5% overhead while sampling). Or add `monitorEventLoopDelay` metrics in code. |
| No request latency in Nginx logs | Cannot split CPU from waiting time | Fix #5 |
| No DB stats | Cannot rank queries or confirm Supabase latency | Supabase dashboard → Query Performance, or a `pg_monitor` role |
| Logs from before the 03:48 reboot are gone | No history for the earlier "100–120% CPU" | Keep PM2 logs (pm2-logrotate) |
| `/proc/<pid>/io` and `fd` | Cannot count handles or sockets per process | Not needed for now |

**Disclosure:** at about 17:31 UTC my `pm2 jlist` run as `ai-audit` spawned an empty PM2 daemon (PID 98746, `/home/ai-audit/.pm2`, about 2% CPU and 76 MB). It manages no apps. Stopping it (`pm2 kill` as `ai-audit`) is pending your approval.

**Credentials:** rotate the `ai-audit` password (it was shared in chat), the hardcoded Observe secret, and the audit ACLs and `adm` membership once you're done (`setfacl -b …`, `gpasswd -d ai-audit adm`).

## 12. Appendix: commands run (all read-only, as `ai-audit`)

- `uptime; nproc; free -m; df -h; cat /proc/loadavg` at 17:31:30
- `mpstat -P ALL 5 12`, `vmstat 5 12`, `iostat -x 5 2`, `pidstat -u -p ALL 5 12`, `pidstat -t -p 95875 5 12` from 17:31:45 to 17:32:45
- `ps -eo … --sort=-pcpu`; `ss -ltnp`; `ss -tn`; `sar -u` (today)
- `/proc/95875/{status,stat,cmdline}`; `systemctl list-units/list-timers`; `systemctl cat maya-watchdog.service`
- `jq` over `/home/ubuntu/.pm2/dump.pm2`, **excluding env fields**; `ecosystem.config.cjs` with key, secret, token and URL lines filtered out
- `awk`/`sort`/`uniq` aggregations over `/var/log/nginx/access.log` and `error.log` (endpoints, status, per hour, per IP, per UA, per second, per 10 min)
- Pattern counts over `maya-backend-{out,error}-2.log`, with JWT, connection-string and long-token patterns redacted
- `grep` for `@Cron`/`@Interval`/`setInterval` in `dist`; static reading of the local repo (paths above)
- **Not done:** inspector attach, signals, `EXPLAIN`, DB queries, any write.
