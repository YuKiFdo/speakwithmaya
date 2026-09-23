# ADR 0003: Authentication Architecture using Supabase Auth

## Status
Accepted

## Context
The application requires authenticated user sessions to:
1. Enforce user minute quotas and daily spend caps.
2. Maintain persistent learning profiles, accents, and progress history.
3. Protect against unauthorized ephemeral token minting.

## Decision
We select **Supabase Auth** as the identity and authentication provider:
1. **Client (`maya-frontend`):** Uses `@supabase/supabase-js` for user registration, login (email/password, OAuth), session refresh, and token storage.
2. **Backend (`maya-backend`):**
   - Implements a NestJS `SupabaseAuthGuard` that extracts the Bearer JWT from incoming requests.
   - Verifies the JWT signature against Supabase's JWKS public endpoint (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`) or shared JWT secret.
   - Attaches the verified `UserPayload` (`sub`, `email`, `role`) to the NestJS request execution context.
3. **Guest / Anonymous Mode:** A device-bound anonymous session can be created via Supabase anonymous sign-in to allow onboarding trial minutes before requiring full sign-up.

## Consequences
- **Positive:** Standardized, secure authentication without building custom password hashing or OAuth flows from scratch.
- **Negative:** Requires external dependency on Supabase project configuration; environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be configured.
