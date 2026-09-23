# Threat Model: Maya AI (STRIDE & Web Hardening)

*Phase 0 Threat Modeling draft per Rule 06-security-privacy-testing.md and Section 4 of Master Prompt.*

---

## 1. System Overview & Trust Boundaries

```
[ Learner Browser / Device ]
           |
     (1) HTTPS (Supabase JWT, Quotas)
           v
[ NestJS Backend API ] ---- (2) Google GenAI Auth API (Server Key) ----> [ Gemini Auth Service ]
           |
     (3) Ephemeral Token (Scoped, 30m)
           v
[ Learner Browser Client ] ---- (4) Direct WSS (Constrained Token) ----> [ Gemini Live API ]
```

### Trust Boundaries:
- **Boundary A (Public Client):** The browser application. Memory, storage, and network traffic are completely visible to the end user.
- **Boundary B (Backend Core):** NestJS API server in secure VPC. Holds database credentials, Supabase service role keys, and Google Gemini Master API Key.
- **Boundary C (Third-Party AI & Auth Providers):** Google Gemini API and Supabase Auth.

---

## 2. STRIDE Analysis

| Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates an authorized user to consume session minutes. | High | All token minting endpoints require verified Supabase Bearer JWT via `SupabaseAuthGuard`. Device fingerprints and IP rate limits applied. |
| **Tampering** | Malicious client attempts to override model parameters, alter system instructions, or increase max duration. | Critical | **Server-locked ephemeral token constraints.** The client cannot set system prompt, model name, or modalities; all constraints are embedded into the token signature at `authTokens.create`. |
| **Repudiation** | User disputes consumed minutes ledger or claims phantom charges. | Medium | Append-only ledger in backend Postgres database recording session start, finish, duration, audio token count, and correlation IDs. |
| **Information Disclosure** | Gemini Master API key is leaked in client bundle, network headers, or GitHub repo. | Critical | Master API key is isolated on backend environment variables only (`GEMINI_API_KEY`). Ephemeral tokens are minted with 30-minute expiration and 1-minute usage window. Automated grep scan in CI ensures zero keys in `dist/`. |
| **Information Disclosure** | Raw voice audio or user transcripts are stored indefinitely or logged to server logs. | High | **Safe Logging Policy:** Structured JSON logs strip raw audio buffers, base64 payloads, transcripts, and PII. Voice data processed ephemerally. |
| **Denial of Service** | Bot script floods `POST /v1/session-token` to exhaust Gemini API quota or server resources. | High | NestJS `@nestjs/throttler` rate limiting per IP and per authenticated user ID; daily spend ceiling per user; global circuit breaker kill-switch. |
| **Elevation of Privilege** | Normal user attempts to access administrative usage reports or reset quota balances. | High | Strict role-based authorization guards on administrative routes. DTO validation with `whitelist: true, forbidNonWhitelisted: true`. |

---

## 3. Web-Specific Threats & Countermeasures

1. **Cross-Site Scripting (XSS):**
   - *Risk:* Injected script extracts Supabase session token or intercepts microphone audio stream.
   - *Defense:* Content Security Policy (CSP) headers restricting script execution (`default-src 'self'`), sanitization of all rendered inputs, zero `dangerouslySetInnerHTML`.
2. **Cross-Origin Resource Sharing (CORS):**
   - *Risk:* Unauthorized origins making authenticated API calls from user browsers.
   - *Defense:* Strict origin allowlist (`CORS_ORIGINS`). Wildcard `*` origins are strictly forbidden in production.
3. **Clickjacking:**
   - *Risk:* Malicious site embeds Maya in an iframe to trick user into enabling microphone or initiating sessions.
   - *Defense:* `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` via Helmet.
4. **Token Storage in Browser:**
   - Ephemeral tokens are held strictly in runtime memory (JavaScript closure/state) and never persisted in `localStorage` or `sessionStorage`.

---

## 4. Sri Lanka Personal Data Protection Act (No. 9 of 2022) Compliance

- **Biometric Nature of Voice Data:** Voice recordings constitute personal biometric data.
- **Lawful Processing & Explicit Consent:** An explicit, unbundled consent dialog must be accepted before microphone capture starts.
- **Child Protection (Under 18 Users):** Since users of all ages are allowed, parental/guardian consent notice must be provided during onboarding for minors.
- **Right to Erasure (Article 16):** The backend must provide an automated deletion endpoint that purges user data and any cached audio/transcripts upon request.
- **Minimal Retention:** Audio clips are ephemeral by default and automatically purged per documented retention schedule.
