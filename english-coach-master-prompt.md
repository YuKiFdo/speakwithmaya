# Master Prompt: AI English Speaking Coach (Gemini Live) — for Gemini Code

**Stack:** Expo (React Native + React Native for Web, one codebase) · **Web first**, responsive · Native iOS/Android later · NestJS backend · Tests run on web

**How to use:** Save this file as `Gemini.md` (or `docs/MASTER_PROMPT.md`) in an empty repo. Screen images from the backend/design owner go into `design/inbox/` as they arrive (see §3.1). Then start Gemini Code and send: `Read Gemini.md fully. Start Phase 0 only. Stop at the gate and wait for my approval.`

---

## 1. ROLE AND MISSION

You are a principal engineer and tech lead building a production-grade, mobile-first **AI English speaking coach**. Learners hold real-time voice conversations with an AI tutor that (a) speaks in a chosen accent, (b) uses natural expression and intonation, and (c) gives corrective feedback on pronunciation, fluency and expression.

Core engine: **Gemini Live API** (native audio speech-to-speech). Target market: learners in Sri Lanka, many on low-end Android devices and unstable networks.

### 1.1 Platform strategy (decided by me, not up for debate)

1. **One universal client codebase** using **React Native via Expo**, targeting web, iOS and Android. Web is rendered with **React Native for Web** and routed with **Expo Router** (file-based, same routes on every platform). Do not create a separate React/Next.js web app.
2. **Web first.** We build and ship the web app first. It must be **fully responsive from a ~360 px phone viewport up to large desktop**. The phone-width layout of the web app **is the mobile-app layout**, so the native apps in Phase 11 reuse the same screens with minimal changes.
3. **Native (iOS/Android) comes after web** (Phase 11). Until then, keep all shared code native-safe (see §5) and isolate browser-only or native-only code behind platform files (`*.web.ts(x)`, `*.native.ts(x)`), so nothing has to be rewritten later.
4. **Backend is NestJS** (TypeScript). It also provides the screen designs (see §3.1).
5. **Automated tests run on web.** Web is the primary e2e target until the native phase.

## 2. HARD CONSTRAINTS (non-negotiable)

1. **Cost:** variable AI cost must be **≤ LKR 1.50 per minute of session time**, measured on the reference conversation profile defined in Phase 1. If the design cannot meet this, you must say so with numbers and propose mitigations. Never hide or fudge a cost result.
2. **Never trust memory for external facts.** Model IDs, prices, limits, token rates, API shapes, **and Expo/React Native/NestJS/Playwright APIs and versions** change often. Read the official docs during Phase 0 and record findings in `docs/facts.md` with source URLs and the date read. If docs conflict with this prompt, the docs win. Log the conflict in an ADR. Do not use approaches the docs mark as deprecated (for example, Expo's docs mark `@expo/webpack-config` as deprecated; web is bundled with Metro via Expo Router).
3. **No secrets in the client.** The Gemini API key must never ship in the web bundle or the native app, appear in a network response, or be committed. Use short-lived ephemeral tokens minted by the NestJS backend (verify current support and how a **browser** WebSocket must pass the token, in the docs). Web bundles are public: assume anything in them is readable by everyone.
4. **Privacy first:** voice is personal data. Explicit consent, minimal retention, user-triggered deletion, compliance with Sri Lanka's Personal Data Protection Act (No. 9 of 2022) and store/browser policies. Flag anything needing legal review. Do not present legal conclusions as final.
5. **No unverified claims.** Never write "should work" or "this fixes it". Only report what you ran and observed. If something needs a real device, real microphone, a specific browser you cannot run, or a paid API call you cannot do, say exactly what is unverified and give me a manual test script.
6. **Cost-safe testing:** live API calls in tests are opt-in (`LIVE_TESTS=1`), capped by a hard budget guard (default US$0.50 per run), and never run in default CI. Web e2e tests use a fake Live server by default.
7. **Design fidelity:** implement screens from the images supplied by the backend/design owner (§3.1). Do not invent screens, flows, copy or features that are not in the images. If something is missing or ambiguous, ask.

## 3. WORKING AGREEMENTS (apply to EVERY task in EVERY phase)

For each task, follow this loop and show evidence:

1. **Acceptance criteria** — write them down before coding (testable, measurable).
2. **Test first** — write failing tests for the criteria (unit, component, integration, contract, web e2e as appropriate). Show them failing.
3. **Implement** — smallest change that passes.
4. **Run everything** — lint, type-check, unit, component, backend integration, **web e2e (Playwright)**, web build (`expo export --platform web`), API build. Paste the real command output summary (pass/fail counts, coverage).
5. **Self-review the diff** against the criteria and the security checklist (§5).
6. **Independent review pass** — re-read the change as a hostile reviewer (or use a separate reviewer subagent/context if available). List concrete defects found and fix them.
7. **Docs** — update README, ADRs, runbooks, and `CHANGELOG.md`.
8. **Commit** — small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), never a broken build on main.

**Gates:** Each phase ends with a **Verification Gate**. Produce a `docs/gates/phase-N.md` report using the template in §6. **Stop and wait for my approval** before starting the next phase. If a gate check fails, fix it and rerun. Do not skip or weaken tests to pass.

**Ask before guessing:** at the start of Phase 0, ask me all blocking questions in ONE batch: web + API hosting, auth provider, payment method, target accents, minimum browser versions (Android Chrome, iOS Safari, desktop), whether learners may be under 18, how screen images will be delivered and named (and whether a Figma/design system exists), package manager preference, and styling approach preference (default in §4 Phase 0). Native minimum OS versions can wait until Phase 11. Then proceed.

### 3.1 Design intake protocol (screen images from the backend/design owner)

The backend/design owner provides images of each screen, **step by step, in the order they want them built**. Some screens come with a mobile image only; some with both mobile and web. Treat the images as the source of truth.

**Folders and manifest**
- `design/inbox/` — new images as they arrive. Default naming (adapt if I say otherwise): `NN-<flow>-<screen>-mobile.png` and `NN-<flow>-<screen>-web.png`.
- Once a screen is accepted, move its images to `design/screens/<flow>/`.
- `design/manifest.md` — one row per screen: `id`, flow, step order, name, mobile image, web image, **status**, API endpoints used, open questions.
- **Status values:** `mobile-only` → `web-derived (awaiting approval)` → `approved`; or `mobile+web provided` → `approved`. A derived web layout is never `approved` until I say so.

**Per-screen procedure (for every screen, in order)**
1. **Read the image(s)** and write down what you see: layout, components, exact visible copy, icons/assets, colours, spacing, radii, typography, interactions implied.
2. **List missing states** the image does not show (loading, empty, error, offline, permission denied, quota exhausted, reconnecting). Mark them `inferred` and propose them; do not treat them as approved design.
3. **Extract design tokens** (colour, type scale, spacing, radius, elevation) into a shared tokens module. Values read from a PNG are approximate: say so, and ask whether a design system or Figma exists to replace them.
4. **Mobile layout:** build the phone layout to match the image (target 360–430 px wide, then verify 320 px still works).
5. **Web layout:**
   - If a web image is provided, build it for the desktop breakpoint.
   - If **only a mobile image exists, you must design a proper, aligned web (tablet/desktop) layout yourself.** Do not just stretch the phone screen. Follow §3.2, produce a short wireframe/description plus a real screenshot, mark the screen `web-derived (awaiting approval)`, and ask me to approve or adjust it.
6. **Test it** (see Phase 6 for test types): component tests for every state, Playwright at all three viewports (§3.2), automated accessibility check, and a screenshot baseline.
7. **Fidelity report:** write `docs/screens/<id>.md` with the reference image next to the Playwright screenshot, a list of intentional deviations, and the inferred states.
8. **Ask, don't guess:** if an image is unclear, contradicts another screen, or a needed screen is missing, stop and ask. If a later screen is not delivered yet, stub the route and record it in the manifest instead of inventing it.

### 3.2 Responsive rules (apply to every screen)

- **Breakpoints (configurable tokens):** phone `< 768 px` (this is the mobile-app layout), tablet `768–1023 px`, desktop `≥ 1024 px`. Verify at 360, 390, 768, 1024, 1440 px wide.
- **Phone:** matches the supplied mobile image; primary navigation as shown in the design (for example bottom tabs).
- **Tablet/desktop derived layouts:** centered content container with a max width; use multi-column or master–detail layouts where the content suits it (for example practice screen = conversation plus a side panel with scenario, tips and timer; summary = feedback beside progress); navigation moves from bottom tabs to a sidebar or top bar; readable line lengths; pointer and keyboard support (visible focus states, hover states, tab order, Enter/Space/Escape behave sensibly); touch targets stay large on touch devices.
- **Never** rely on fixed pixel widths; use flex/grid-style layout and a shared `useBreakpoint`-style hook. Respect safe areas and the mobile browser dynamic viewport (address bar show/hide).
- Text must survive 200% zoom and large-text settings without clipping or overlap.

## 4. PHASES

### Phase 0 — Discovery, facts, architecture, scaffolding
**Tasks**
- Read the official **Gemini Live API** docs and pricing. Record in `docs/facts.md`: current recommended Live model ID(s), audio in/out formats and sample rates, tokens per second of audio, per-token prices (audio in, audio out, text), session duration limits, context window compression, session resumption, voice activity detection (VAD) settings, usage metadata fields, ephemeral token support and constraints (**including how a browser client connects and authenticates with one**), rate limits/quotas, supported languages/voices, and how accent/style can be controlled.
- Read the official **Expo / React Native for Web / Expo Router** docs. Record in `docs/facts.md`: the current Expo SDK version to pin; the exact web setup steps and dependencies (the docs list `react-dom`, `react-native-web` and `@expo/metro-runtime` installed via `npx expo install`; confirm current); how web bundling works (Metro, not the deprecated webpack config); the `web.output` modes (`single`, `static`, `server`) and which we choose (set it **explicitly**; defaults have changed between SDK versions); how to structure a monorepo with Expo/Metro; platform-specific file extensions; environment variable handling for web vs native; how to unit-test with `jest-expo` and `expo-router/testing-library` (`renderRouter`); and which Expo/Web APIs are available for microphone capture and audio playback on web vs native. Note that custom native audio may require a development build instead of Expo Go (verify). Produce a **web vs native audio comparison table** in `docs/facts.md` covering: permission model and how each platform declares/asks for it, secure-context and user-gesture requirements, audio session/interruption behavior (calls, other apps, Bluetooth/headphone changes), background/screen-lock behavior, native sample rates vs the 16 kHz/24 kHz the Live API needs (resampling), echo cancellation/noise suppression support, and known browser quirks (iOS Safari, Android Chrome, Firefox). Every row needs a source URL; anything you cannot confirm from docs is marked "unverified".
- Read the official **NestJS** docs for the pieces we need (modules, guards, pipes, interceptors, config, validation, rate limiting, OpenAPI, testing) and the **Playwright** docs (projects/devices, web server integration, screenshots, fake media devices for microphone testing in Chromium, accessibility testing). Record versions and sources.
- Propose the architecture and record ADRs (`docs/adr/`). Default unless you justify otherwise:
  - Monorepo, TypeScript everywhere: `apps/app` (Expo universal client: web now, native later), `apps/api` (NestJS), `packages/cost-model`, `packages/shared` (types, tokens), `packages/api-client` (typed client generated from the OpenAPI spec).
  - Postgres, Redis, Docker, GitHub Actions.
  - Styling: React Native `StyleSheet` plus a small design-token and breakpoint layer (add a UI library only via ADR, and only if it fully supports web + native + responsive breakpoints).
  - The browser connects **directly** to Gemini Live using backend-minted ephemeral tokens (lowest latency, no audio relay cost). Compare against a backend relay and against a chained STT→LLM→TTS fallback.
- Scaffold the repo: workspaces, lint, format, strict type-check, pre-commit hooks (secret scan, lint), test runners (Jest for API; `jest-expo` + React Native Testing Library for the client; Playwright for web e2e), CI pipeline, `.env.example`, config validation on both the API and the client build.
- Scaffold the **universal app skeleton**: Expo Router with a root layout, the design-token module, the breakpoint hook, and a responsive shell (phone / tablet / desktop) with a placeholder route. It must actually run on web.
- Write `docs/threat-model.md` (STRIDE, first draft; include web-specific threats: XSS, CORS, token storage, clickjacking, third-party scripts) and `docs/architecture.md` with diagrams (Mermaid).

**Tests / checks**
- CI passes on the scaffold: lint, type-check, unit, API build, **`expo export --platform web` build**, and a **Playwright smoke test** that loads the app on web.
- Playwright smoke test runs in three projects: desktop Chromium, a mobile Chromium device profile, and a mobile WebKit device profile; asserts the shell renders at phone, tablet and desktop widths without horizontal scroll.
- NestJS health endpoint has a unit test and an HTTP-level test.
- Secret-scan hook blocks a planted fake key (prove it, then remove).
- Config validation fails fast on missing/invalid env vars (unit test, both apps).

**Gate:** `facts.md` complete with sources; ADRs approved by me; CI green; universal skeleton demonstrably running on web at 3 viewports; threat model draft reviewed.

### Phase 1 — Cost model and budget harness (before any feature)
**Tasks**
- Build a pure, well-typed `cost-model` package: inputs = price config (from `facts.md`, never hardcoded in logic), exchange rate (configurable, default 300 LKR/USD, must be updated from a trusted source before release), token rates, and a **conversation profile** (user speaking seconds, AI speaking seconds, silence seconds, turns, context growth).
- Model, at minimum, these profiles: **A** always-on mic, chatty AI; **B** gated mic (only speech sent) with short replies (reference profile for the budget); **C** worst case (long replies, no gating, long context).
- Include re-billed context per turn and transcription tokens if enabled. Read the pricing page/forum notes to model this correctly and mark any assumption clearly.
- Output a cost report (`docs/cost-report.md`): USD and LKR per minute for each profile, sensitivity to exchange rate, reply length, and session length.

**Tests**
- Unit tests with hand-computed expected values (e.g., 25 tokens/s × 60 s × price). Use exact arithmetic, not rounded figures.
- Property tests: cost is non-negative and monotonic in each input; zero usage → zero cost; currency conversion round-trips.
- **Budget test:** profile B ≤ LKR 1.50/min or the test fails with a message listing mitigations.
- Snapshot test of the cost report.

**Gate:** honest cost report reviewed. If profile B fails the budget, stop and present options (tighter gating, reply caps, session caps, hybrid pipeline, tiered plans). I decide before Phase 2.

### Phase 2 — Backend foundation (NestJS)
**Tasks**
- NestJS modules with clear boundaries (auth, users/devices, sessions/tokens, usage-ledger, quotas, health). Controllers stay thin; business logic lives in services; every input goes through validation (DTOs/pipes); authorization via guards on every endpoint.
- Auth (provider per ADR), user model, device/browser binding.
- `POST /v1/session-token`: mints a short-lived, single-use, scoped ephemeral token with locked config (model, system prompt version, response modalities, max duration). Client cannot override the locked config.
- Quotas and rate limiting per user/device/IP. Usage ledger (append-only) recording each session's seconds, tokens, computed cost.
- **CORS locked to an explicit allowlist of web origins**; secure headers; idempotency; structured logging with correlation IDs; health/readiness endpoints; OpenAPI spec published from the code, and a **typed client generated from it** for the app.
- Screen-design delivery endpoints/workflow are outside this scope unless I say otherwise (images arrive through `design/inbox/`, §3.1). Ask me if the backend expects the app to fetch anything design-related at runtime.

**Tests**
- Unit and integration tests (Jest, `@nestjs/testing`, HTTP-level tests with supertest, real Postgres/Redis via containers).
- Security tests: unauthenticated → 401; expired/reused token → rejected; quota exceeded → 429; client-supplied config overrides ignored; disallowed CORS origin rejected; API key never appears in any response, log line, **or the built web bundle** (automated grep of `dist/` and other build artifacts).
- Concurrency test: parallel token requests cannot exceed quota.
- Contract test: OpenAPI schema matches actual responses; the generated client compiles against it.
- Coverage ≥ 85% on core modules.

**Gate:** all tests green; security tests demonstrated by trying to break them; OpenAPI published.

### Phase 3 — Real-time voice engine (client core, web first)
**Tasks**
- Define platform-agnostic interfaces (`AudioCapture`, `AudioPlayer`, `LiveTransport`) injected via dependency injection. Implement the **web** versions now (browser microphone capture with echo cancellation/noise suppression requested, audio processing off the main thread as the docs recommend, 16-bit PCM 16 kHz in and 24 kHz out per the Live docs, jitter buffer, playback queue). Leave the native implementations as documented stubs for Phase 11.
- **Platform parity:** write a shared **audio contract test suite** (permission granted/denied/revoked, start/stop, chunk size and format, resampling accuracy, playback queue, barge-in stop, device change, interruption, no-mic) that runs against the web implementation now and is reused unchanged against the native implementation in Phase 11. Keep `docs/audio-platform-matrix.md` listing each behavior, its web result, its native result (blank until Phase 11), and any intentional difference.
- Handle browser realities: microphone permission flow and denial; secure-context (HTTPS) requirement; audio contexts that must be resumed from a user gesture (iOS Safari especially); tab backgrounded/locked; device change (headphones plugged/unplugged); no mic present.
- WebSocket session manager: connect, setup, streaming, **barge-in** (stop playback immediately when user speaks), graceful end.
- **Client-side VAD gating**: send audio only while the user is speaking (plus small pre-roll); expose sensitivity settings; push-to-talk mode as a fallback.
- **Cost controls in-engine:** enforce max reply length via prompt + config, session duration cap, context window compression, session resumption on drops, live cost meter using server usage metadata.
- Robust reconnect with backoff; state machine (idle, connecting, listening, thinking, speaking, reconnecting, ended) with exhaustive transitions.

**Tests**
- Build a **fake Live server** (mock WebSocket) that replays recorded message fixtures and can inject latency, drops, malformed frames, and out-of-order events. Both unit tests and Playwright e2e use it.
- Deterministic audio fixtures (silence, speech, noise, clipping, overlapping speech). In Playwright (Chromium), feed the fixtures through the browser's fake microphone device so the real capture path is exercised.
- Assertions: silence sends ~zero audio frames; speech onset pre-roll is included; barge-in stops playback within the target latency (define, e.g., < 300 ms); reconnect resumes the session without losing state; state machine rejects illegal transitions; cost meter matches the Phase 1 model within tolerance on fixtures.
- Chaos tests (Playwright): network drop mid-utterance (offline emulation), token expiry mid-session, mic permission revoked mid-session, tab hidden/visible.
- Opt-in live smoke test (`LIVE_TESTS=1`) with budget guard: connect, one utterance, receive audio, verify usage metadata parsed.
- Manual test script for real mic/speaker on: **Chrome on a low-end Android phone, Safari on an iPhone, and desktop Chrome/Safari/Firefox.** Record results.

**Gate:** all automated tests green; manual script results recorded; measured time-to-first-audio and barge-in latency reported with p50/p95 per browser tested.

### Phase 4 — Tutor persona, accents, expression
**Tasks**
- Versioned system prompts in `prompts/` (semver, changelog, tested). Configurable: **accent** (e.g., neutral British, General American, Australian — confirm list with me), speaking pace, CEFR level (A1–C1), correction style (immediate vs end-of-turn), and topic/roleplay scenarios (interview, travel, phone call, small talk).
- Expression behavior: natural intonation, warm encouraging tone, appropriate emphasis; model good stress and intonation on request ("say it again slowly", "show me a friendlier tone").
- Guardrails: stay on task, age-appropriate, refuse unsafe content, resist prompt injection spoken by the user ("ignore your instructions"), never reveal the system prompt, keep replies short (target ≤ N seconds, set from the cost model).
- Accent/voice selection mapped to available voices per `facts.md`.

**Tests**
- Automated eval suite (`evals/`): 40+ scripted scenarios run against a text-mode or audio-mode harness. Rubric-scored (LLM judge with a fixed rubric plus deterministic checks): stays in English, level-appropriate vocabulary, correction present when an error is planted, brevity within limit, refuses off-task/unsafe requests, resists injection.
- Deterministic checks: reply duration/length percentiles; no prompt leakage; JSON/tool-call schemas valid.
- **Accent and expression cannot be fully verified by text tests.** Therefore: generate audio samples per accent/voice/scenario into `evals/audio-samples/`, and produce a **human listening checklist** (accent consistency, clarity, naturalness, emotional tone, pacing). I will review it. List each item as pass/fail with notes.
- Regression: any prompt change reruns the eval suite and fails CI on score drop beyond a threshold.

**Gate:** eval report (scores per category), audio samples ready for my listening review, human checklist signed off by me.

### Phase 5 — Pronunciation and expression feedback engine
**Tasks**
- Capture user audio clips locally during the session (only with consent; ephemeral by default; on web, keep clips in memory or short-lived browser storage and never persist longer than the retention policy).
- After the session, send selected clips in a **batch** call to a Gemini audio-understanding model (input-only, cheaper than Live output) and request **structured JSON** (JSON schema): mispronounced words with the expected vs heard sound, stress/intonation notes, pace (words per minute), filler words, grammar notes, an overall summary, and 3 actionable drills.
- Score with a transparent rubric (documented). Feedback must reference only words present in the transcript (no hallucinated words). Include a confidence value; low confidence → soft wording.
- Optional: pluggable interface for a dedicated pronunciation-assessment API as a second opinion (behind a feature flag). Compare cost and accuracy before adopting.

**Tests**
- JSON schema validation on every response (fuzz with malformed model output; repair or safe-fallback path).
- Labeled test set (≥ 50 short clips: native and non-native, planted errors known in advance, some with noise). Measure agreement with human labels (precision/recall on flagged words); set thresholds with me.
- Consistency: same clip scored 5× → variance within an agreed bound.
- Hallucination test: every flagged word must exist in the transcript.
- Cost test: feedback cost per session-minute added to the Phase 1 model; total must remain within budget or be flagged.
- Privacy test: clips are deleted per the retention policy (server side and browser side); deletion endpoint verified.

**Gate:** accuracy metrics and cost impact reported honestly; known limitations documented in-app copy (feedback is guidance, not certification).

### Phase 6 — Client app UX (web, responsive) — built screen by screen from the design images
**Tasks**
- Implement screens **in the order the design owner delivers them**, using the §3.1 procedure for each screen and §3.2 for responsiveness. Expected areas (build only what the images show): onboarding (level check, accent choice, goals, mic permission rationale, consent screens), practice screen (mic state, live captions optional, cost/time remaining), scenario picker, session summary with feedback, progress history, settings.
- Every screen ships at phone, tablet and desktop layouts. Mobile-only images get a derived web layout awaiting my approval (§3.1 step 5).
- Poor-network UX (clear states, auto-reconnect, offline messaging), low-end device performance on mobile browsers, dark mode (only if the designs include it; otherwise ask), accessibility (labels, roles, contrast, keyboard navigation, focus order, large text), i18n-ready (English first; Sinhala/Tamil UI strings scaffolded, and check the chosen fonts render Sinhala and Tamil on web).
- Deliver in screen batches; after each batch update `design/manifest.md` and stop for my review of derived web layouts before building on top of them.

**Tests**
- Component tests (`jest-expo` + React Native Testing Library) for every screen and every state; routing tests with `expo-router/testing-library`.
- **Web e2e with Playwright** for: onboarding → first session → summary; permission denied; network loss; quota exhausted; page reload/tab closed and resumed. Run in desktop Chromium, mobile Chromium and mobile WebKit projects (Firefox desktop as a smoke run).
- **Visual checks:** Playwright screenshots at 360, 390, 768, 1024 and 1440 px for every screen; baselines are stored only after I approve; reference-vs-actual comparison reports in `docs/screens/`.
- Accessibility: automated axe-style checks inside the Playwright runs plus a manual checklist (keyboard-only pass, screen reader pass on at least one platform).
- Performance budget: web bundle size, load time and interaction latency under mobile CPU/network throttling; memory and battery drain per 10-minute session measured manually on a low-end Android phone in Chrome.

**Gate:** all screens in the manifest implemented and either `approved` or explicitly listed as pending my approval; web e2e green in all browser projects; performance numbers recorded; manual real-device pass documented.

### Phase 7 — Plans, quotas, billing reconciliation
**Tasks**
- Minutes wallet/plans, session and daily caps, graceful "minutes low" flow. Payment integration per ADR (local payment options considered; confirm which work in a web checkout).
- **Reconciliation job:** compare internal ledger against Google Cloud billing export/usage data; alert on drift above a threshold.
- Cost guardrails: per-user daily spend ceiling, global kill switch, anomaly alert (cost per minute p95 above target).

**Tests**
- Idempotent ledger writes, race-condition tests (double-spend of minutes), refund/rollback paths.
- Reconciliation test with synthetic billing data including drift.
- Simulated abuse (token farming, parallel sessions across tabs/browsers, replay) → blocked and alerted.
- Web e2e for the purchase and "minutes low" flows against a sandbox/fake payment provider.

**Gate:** finance and abuse scenarios demonstrated; drift alert proven.

### Phase 8 — Security and privacy hardening
**Tasks**
- Complete the threat model. Apply OWASP ASVS (and MASVS for the later native build) checks. **Web-specific:** Content-Security-Policy, CORS, secure headers, clickjacking protection, XSS review, where and how the app's session credentials are stored in the browser (memory vs cookie vs storage) with an ADR, third-party script policy, subresource integrity where relevant.
- Data map, retention schedule, consent records, data-subject deletion/export, encryption in transit and at rest, backups.
- Dependency audit, SAST, container scan, license check, SBOM.

**Tests**
- Automated: dependency audit, SAST, secret scan, container scan in CI (fail on high severity).
- Manual: intercept traffic with a proxy and confirm no keys/PII leakage; attempt token replay; attempt to modify locked session config; try to run the app with a hostile CSP-violating script.
- Deletion test: user data removed from DB, storage, and backups per policy.

**Gate:** zero open high/critical findings; residual risks documented; items needing legal review listed.

### Phase 9 — Non-functional: performance, reliability, observability
**Tasks**
- Structured logs, metrics, traces, dashboards, alerts: time-to-first-audio, session success rate, reconnect rate, **cost per minute (p50/p95)**, quota errors, feedback failures, web-vitals-style client metrics.
- Graceful degradation: if Live quota/errors spike → fall back to the chained pipeline or text mode; feature flags and a remote kill switch.
- Load test the backend (token minting, ledger), soak test (60-minute sessions), and multi-region latency check.

**Tests**
- Load test with defined SLOs (e.g., token endpoint p95 < 300 ms at target RPS). Chaos test: upstream 429/500/timeouts → degrade correctly (verified through web e2e as well).
- Alert tests: trigger each alert deliberately and confirm delivery.
- Runbooks exist and are exercised once (game day).

**Gate:** SLO report, dashboards live, runbooks reviewed.

### Phase 10 — Web release
**Tasks**
- CI/CD with staged rollout, semantic versioning, migrations with rollback, production web build and hosting per ADR (the Expo docs describe hosting options, including EAS Hosting; read current guidance), HTTPS everywhere, privacy policy and terms drafts (flag for legal review), beta program with in-app feedback and cost monitoring.
- Documentation: README, onboarding for new engineers, API docs, ops runbooks, cost playbook (how to adjust reply caps, gating, and plans when prices change).

**Tests**
- Full regression on a release candidate: unit, component, integration, web e2e (all browser projects), visual baselines, evals, security, load.
- Rollback rehearsal (deploy, roll back, verify data integrity).
- Beta: measure real cost per minute vs. the model; report drift.

**Gate:** web release checklist 100% checked; go/no-go report for me.

### Phase 11 — Native apps (iOS and Android) from the same codebase
*Start only after I approve the web release.*

**Tasks**
- Read the current Expo docs for development builds, EAS Build/Submit, and native audio APIs; update `docs/facts.md`; confirm minimum Android/iOS versions with me.
- Implement the native `AudioCapture`/`AudioPlayer` (and any transport differences) behind the existing interfaces; reuse the same screens, routes, state machine and cost controls. Native-only differences go in `*.native.ts(x)` files.
- **Do not assume web audio behavior carries over.** Run the Phase 3 shared audio contract suite against the native implementation, fill in the native column of `docs/audio-platform-matrix.md`, and explain every difference from web.
- Native concerns: microphone permission declarations and rationale, OS audio session setup, background/foreground audio behaviour, interruptions (incoming call, alarm, other audio app), Bluetooth/headphone switching, screen lock, secure token storage, deep links, app icons/splash, store listings, store privacy declarations.
- Manual native audio checklist on a real low-end Android and a real iPhone: permission deny/allow/revoke in system settings, incoming call mid-session, switch to Bluetooth mid-session, lock screen and return, background and return, another app grabbing the mic. Record pass/fail per item.
- Store submission checklist.

**Tests**
- The shared unit/component tests run under the iOS and Android presets as well.
- Native e2e for the critical flows (Expo's docs recommend Maestro; verify current guidance): onboarding → first session → summary; permission denied; network loss; app killed and resumed.
- Performance and battery per 10-minute session on a low-end Android device; manual pass on at least one low-end Android and one iOS device.

**Gate:** native e2e green on emulator/simulator; real-device results recorded; store checklist complete; go/no-go report for me.

## 5. CROSS-CUTTING STANDARDS

- **Code:** strict TypeScript, no `any` without justification, small modules, dependency injection for the audio/network layers so they are testable.
- **Universal-code rule:** shared UI code uses React Native primitives and Expo APIs only. No direct `window`/`document`/DOM use in shared files; browser-only code lives in `*.web.ts(x)` and native-only code in `*.native.ts(x)`, behind a common interface. Guard anything that must not run during server/static rendering if that mode is used.
- **Backend (NestJS):** feature modules, DTO validation on every input, guards for authz, no business logic in controllers, config through the validated config module, OpenAPI generated from code and kept in sync (contract-tested).
- **Tests:** deterministic, no flaky tests (quarantine and fix immediately), coverage ≥ 85% on core logic, mutation testing on the cost model and state machine if feasible. Web e2e never uses real Gemini calls unless `LIVE_TESTS=1`.
- **Config:** everything via validated env/config; prices, exchange rate, token rates, model IDs, breakpoints, and limits are configuration, never scattered constants. Remember that public client env vars end up in the web bundle: only non-secret values go there.
- **Security checklist per PR:** input validation, authz on every endpoint, no secrets, least privilege, safe logging (no audio/PII in logs), dependency changes reviewed, CORS/CSP not loosened without an ADR.
- **Performance:** no blocking work on the main/audio thread; measure, do not guess; keep the initial web bundle small (low-end phones, slow networks).
- **Docs:** every decision in an ADR; every public function documented; runbooks for every alert; `design/manifest.md` always current.

## 6. GATE REPORT TEMPLATE (`docs/gates/phase-N.md`)

```
# Phase N Gate Report
- Date / commit SHA:
- Scope delivered:
- Acceptance criteria → evidence (test names, command output summary):
- Test results: unit / component / API integration / web e2e (per browser project + viewport) / evals (pass/fail counts, coverage)
- Screens (Phase 6 onward): manifest rows delivered, status of each (reference provided / web-derived awaiting approval / approved)
- Cost impact (USD & LKR per min vs. LKR 1.50 target):
- Security review: findings and fixes
- Independent review: defects found and fixed
- NOT verified (needs real device / specific browser / live key / human): + manual test script
- Known risks and open questions:
- Recommendation: proceed / fix first
```

## 7. FINAL DEFINITION OF DONE

- All phase gates passed and approved by me.
- Every screen in `design/manifest.md` implemented on web at phone, tablet and desktop layouts and approved by me; native apps reuse the same screens and pass the same critical-flow tests.
- Measured cost per session-minute on the reference profile ≤ LKR 1.50, with a live-vs-model drift report from the beta.
- Accent and expression quality signed off through my listening review.
- No open high/critical security findings; privacy and deletion flows verified.
- CI green including web e2e and evals; runbooks, dashboards, kill switch, and rollback proven.

## 8. FIRST ACTION

Do **Phase 0 only**. Begin by asking me your blocking questions in one batch, then proceed. Do not write feature code before the Phase 1 cost gate is approved. (The Phase 0 universal app skeleton is scaffolding only, not feature code, and screen images are not needed until Phase 6.)
