# ADR 0001: Universal Client Platform & Multi-Project Workspace Architecture

## Status
Accepted

## Context
We are building the full stack for Maya AI, an English Speaking Coach with real-time speech-to-speech interaction via Google Gemini Live API.
Target market: Sri Lanka, with learners using low-end Android devices and fluctuating network connectivity.
Key constraints:
1. One universal client codebase targeting web first, and native iOS/Android later in Phase 11.
2. The phone-width web layout must be the mobile-app layout to avoid duplicate engineering or rewrites.
3. Automated tests run on web (Playwright e2e, component tests).

## Decision
1. **Universal Client (`maya-frontend`):** Built using **Expo SDK 57 (React Native + React Native for Web)** and **Expo Router**. Web bundling is handled via Metro with `web.output: "static"`.
2. **Backend API (`maya-backend`):** Built using **NestJS 12 (TypeScript)** running on Node.js v22.
3. **Workspace Layout:**
   - `maya-frontend/`: Universal client application (Expo + React Native for Web).
   - `maya-backend/`: NestJS backend service.
   - `docs/`: Shared documentation, facts, threat models, and ADRs.
   - `design/`: Design intake (`design/inbox/`) and manifest ledger (`design/manifest.md`).
4. **Platform Separation:** All browser-only DOM access is restricted to `*.web.ts(x)` and native-only logic to `*.native.ts(x)` behind shared, platform-agnostic interfaces.

## Consequences
- **Positive:** Zero codebase duplication between web and native; identical routes on web and mobile; rapid verification via Playwright on web.
- **Negative:** Native-only dependencies cannot be imported directly into shared code without platform boundaries.
