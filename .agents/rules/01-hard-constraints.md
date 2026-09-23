---
trigger: always_on
description: Non-negotiable hard constraints including budget limits, external fact verification, secret handling, and design fidelity.
---

# Hard Constraints (Non-Negotiable)

1. **Cost Constraint:**
   - Variable AI cost must be **≤ LKR 1.50 per minute of session time**, measured on the reference conversation profile (Profile B: gated mic, short AI replies).
   - If the design or model cannot meet this target, state so clearly with concrete calculations and propose mitigations. **Never hide or fudge a cost result.**

2. **Never Trust Memory for External Facts:**
   - Model IDs, prices, limits, token rates, API shapes, and Expo/React Native/NestJS/Playwright APIs change frequently.
   - Read official documentation and record all facts in `docs/facts.md` with source URLs and dates fetched.
   - If official docs conflict with instructions or prompts, **the official docs win**. Log the conflict in an Architecture Decision Record (ADR).
   - Never use deprecated approaches (e.g., `@expo/webpack-config` is deprecated; Metro is used via Expo Router).

3. **Zero Secrets in Client:**
   - The Gemini API key must **never** ship in the client web bundle or native app, appear in network responses, or be committed to version control.
   - Web bundles are public: assume everything in them is readable by anyone.
   - The client connects using short-lived, single-use, scoped ephemeral tokens minted by the NestJS backend.

4. **Privacy First (Voice as Personal Data):**
   - Explicit user consent before recording or processing voice data.
   - Minimal retention; user-triggered deletion must be supported.
   - Strict compliance with Sri Lanka's Personal Data Protection Act (No. 9 of 2022) and app store/browser privacy policies. Flag items needing legal review.

5. **No Unverified Claims:**
   - Never say "should work" or "this fixes it" without verifying.
   - Report only what was executed and observed with actual terminal output summaries.
   - If a test requires physical hardware, a real microphone, or a paid live API call that cannot be run, state clearly that it is unverified and provide a step-by-step manual test script.

6. **Cost-Safe Testing:**
   - Live API calls in automated tests are strictly opt-in via `LIVE_TESTS=1`.
   - Live runs must be bounded by a hard budget guard (default US$0.50 per run) and never executed in standard CI.
   - Client and web e2e tests must use a fake Live WebSocket server by default.

7. **Design Fidelity:**
   - Screens must be built strictly from the images provided in `design/inbox/`.
   - Never invent screens, user flows, copy, or features not present in the design images. If something is missing or ambiguous, ask before proceeding.
