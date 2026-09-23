# ADR 0002: Direct Browser Connection to Gemini Live via Ephemeral Tokens

## Status
Accepted

## Context
Real-time voice conversation requires low latency ($< 800\text{ ms}$ turn-around, $< 300\text{ ms}$ barge-in).
We evaluated three connection architectures:
1. **Direct Browser Connection with Ephemeral Tokens:** Browser connects directly to Gemini Live WebSockets (`BidiGenerateContentConstrained`) using a short-lived token minted by the NestJS backend.
2. **Backend WebSocket Audio Relay:** Browser streams audio to NestJS backend, which proxies frames to Gemini Live API.
3. **Chained Pipeline (Fallback):** Browser streams audio $\rightarrow$ Speech-to-Text $\rightarrow$ Text LLM $\rightarrow$ Text-to-Speech.

## Decision
We adopt **Option 1: Direct Browser Connection with Ephemeral Tokens** as the primary voice engine architecture.
- The NestJS backend endpoint `POST /v1/session-token` authenticates the user, verifies minutes quota, and mints an ephemeral token from Gemini via `client.authTokens.create`.
- The token configuration is **locked on the server**:
  - Model: `gemini-3.1-flash-live-preview`
  - Versioned system prompt
  - Modalities: `['AUDIO']`
  - Max connection duration: 30 minutes (`expireTime`)
  - Session initiation window: 1 minute (`newSessionExpireTime`)
- The client connects directly to:
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token={token}`

## Consequences
- **Positive:**
  - Lowest possible latency: eliminates the middleman server hop.
  - Zero server audio bandwidth cost: NestJS server does not process gigabytes of raw PCM streaming data.
  - Zero client key leakage: Master API key stays strictly on the backend.
- **Negative:**
  - Token minting requires Google Gemini `v1beta` endpoint support.
  - Session resumption and reconnect logic must be robustly handled in the client state machine.
