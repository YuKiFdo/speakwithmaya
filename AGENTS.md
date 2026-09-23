# Maya AI — English Speaking Coach (Gemini Live)

This repository contains the full stack for the AI English Speaking Coach:
- **`maya-frontend/`**: Universal client built with Expo (React Native + React Native for Web + Expo Router). Web first (responsive 360 px to desktop), native iOS/Android later.
- **`maya-backend/`**: NestJS backend providing authentication, quotas, usage ledger, and Gemini Live ephemeral token minting.
- **`english-coach-master-prompt.md`**: The authoritative master prompt and specification.

---

## Authoritative Rules in `.agents/rules/`

All AI agents working in this repository must strictly adhere to the modular rules defined in `.agents/rules/`:

1. [00-role-and-phases.md](file:///d:/outsource/Maya%20Ai/.agents/rules/00-role-and-phases.md) — Role, universal platform strategy, sequential phase roadmap, and verification gates.
2. [01-hard-constraints.md](file:///d:/outsource/Maya%20Ai/.agents/rules/01-hard-constraints.md) — LKR 1.50/min cost budget, docs verification (`docs/facts.md`), zero secrets in client, privacy/PDPA compliance, no unverified claims, cost-safe testing, design fidelity.
3. [02-working-agreements-loop.md](file:///d:/outsource/Maya%20Ai/.agents/rules/02-working-agreements-loop.md) — 8-step engineering loop for every task, gate reports (`docs/gates/phase-N.md`), batched questions protocol.
4. [03-universal-frontend.md](file:///d:/outsource/Maya%20Ai/.agents/rules/03-universal-frontend.md) — Universal code rules (no direct DOM in shared code, `*.web.ts(x)` / `*.native.ts(x)`), responsive breakpoints (phone < 768px, tablet 768-1023px, desktop ≥ 1024px), cross-platform typography (`fontStyle()` helper, no native `fontWeight` on custom fonts), image styling (no `tintColor` on illustrations), audio engine abstraction (`AudioCapture`, `AudioPlayer`, `LiveTransport`), client VAD and barge-in (< 300ms).
5. [04-backend-nestjs.md](file:///d:/outsource/Maya%20Ai/.agents/rules/04-backend-nestjs.md) — NestJS modular architecture, thin controllers, DTO validation pipes, authorization guards, server-locked ephemeral token minting, strict CORS allowlist, OpenAPI spec & typed client generation.
6. [05-design-intake-responsive.md](file:///d:/outsource/Maya%20Ai/.agents/rules/05-design-intake-responsive.md) — `design/inbox/`, `design/manifest.md`, 8-step per-screen intake procedure, derived web layouts awaiting user approval, screen fidelity reports in `docs/screens/<id>.md`.
7. [06-security-privacy-testing.md](file:///d:/outsource/Maya%20Ai/.agents/rules/06-security-privacy-testing.md) — Security checklist per PR, Sri Lanka PDPA compliance, deterministic testing (≥ 85% coverage), fake Live server default, DO NOT run Playwright.

---

## Key Working Directives

- **Never Assume or Guess External Facts:** Always check official documentation for APIs, pricing, token rates, and versions. Record findings in `docs/facts.md`.
- **Phase Verification Gates:** Stop at each phase gate (`docs/gates/phase-N.md`) and await explicit user approval before proceeding.
- **Budget Compliance:** Profile B cost must remain ≤ LKR 1.50 per minute of session time.
- **Design Truth:** Implement screens strictly from images in `design/inbox/`. Never invent features, routes, or copy.
