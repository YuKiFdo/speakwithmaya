---
trigger: always_on
description: NestJS backend architecture, ephemeral token minting, DTO validation, authorization guards, and CORS security.
---

# NestJS Backend Standards

## 1. Modular Architecture & Responsibilities
- **Feature Modules:** Organize the backend into clean feature modules with strict domain boundaries:
  - `auth`: user and device authentication
  - `users`: user profile, preferences, device/browser bindings
  - `sessions`: session lifecycle and ephemeral token minting
  - `ledger`: append-only usage ledger (session seconds, tokens, calculated cost)
  - `quotas`: rate limiting, minutes wallet, daily spend ceilings
  - `health`: liveness, readiness, and dependency health checks
- **Thin Controllers:** Controllers only map HTTP requests to service calls and return responses.
- **Business Logic in Services:** All business rules, validation logic, and third-party orchestration live in services.

## 2. Input Validation & Authorization
- **Strict DTO Validation:** Every endpoint must validate input payloads using explicit Data Transfer Objects (DTOs) with `class-validator` decorators and NestJS `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
- **Authorization on Every Route:** Guard every endpoint with authentication and role/device guards unless explicitly marked `@Public()`.

## 3. Ephemeral Token Minting (`POST /v1/session-token`)
- Mint short-lived, single-use, scoped ephemeral tokens for the client to connect directly to Gemini Live API.
- **Server-Locked Config:** The minted token must lock down:
  - Model ID
  - Versioned system prompt
  - Allowed response modalities (audio/text)
  - Maximum session duration
- **Zero Client Overrides:** The client must NEVER be permitted to override model parameters or system prompts.

## 4. Security & CORS
- **CORS Allowlist:** Lock CORS strictly to an explicit allowlist of authorized web origins. Never use wildcard `*` origins in production.
- **Secure Headers:** Apply security headers (Helmet, strict CSP, frameguard against clickjacking).
- **Safe Logging:** Use structured JSON logging with correlation IDs. **Never log raw audio streams, user transcripts, or PII.**
- **Secret Scanning:** API keys must never appear in HTTP responses or client-facing endpoints.

## 5. Contracts & Typed Client Generation
- Maintain OpenAPI / Swagger documentation generated directly from code annotations and DTOs.
- Automatically generate a typed TypeScript client from the OpenAPI spec for the frontend app.
- Enforce contract tests verifying that actual API responses strictly match the OpenAPI schema.
