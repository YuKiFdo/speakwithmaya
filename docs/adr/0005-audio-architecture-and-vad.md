# ADR 0005: Real-Time Audio Engine Architecture & Client-Side VAD

## Status
Accepted

## Context
Cost constraint (Profile B $\le$ LKR 1.50/min) and user experience require:
1. Low latency turnaround.
2. Low token consumption: sending continuous silence to Gemini Live burns ~25 tokens/s ($0.005/min input audio cost continuously).
3. Immediate barge-in ($< 300\text{ ms}$ interruption latency).
4. Cross-platform abstractions that run on Web Audio API today and native audio queues in Phase 11.

## Decision
1. **Abstraction Interfaces:** Audio components will implement platform-agnostic TypeScript interfaces:
   - `AudioCapture`: handles mic permissions, stream initialization, resampling, and PCM chunk generation.
   - `AudioPlayer`: handles 24 kHz PCM playback queue, jitter buffering, and immediate stop/flush on barge-in.
   - `LiveTransport`: manages the WebSocket connection, framing, and keepalives.
2. **Web Audio Capture Implementation (`AudioCapture.web.ts`):**
   - Uses `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`.
   - Uses an `AudioWorkletNode` running on a separate audio rendering thread to avoid UI thread jitter.
   - Downsamples incoming audio from native hardware rate (44.1 kHz / 48 kHz) to 16 kHz 16-bit little-endian PCM.
3. **Client-Side VAD (Voice Activity Detection):**
   - Energy-based and zero-crossing rate VAD calculates speech presence in real time.
   - Audio is only transmitted over WebSocket when speech is active, plus a circular pre-roll buffer (200 ms) so the beginning of words is never cut off.
   - Fallback: Push-to-Talk (PTT) toggle for high-noise environments.
4. **Barge-In:**
   - As soon as the client VAD flags speech onset while the AI is speaking, the `AudioPlayer` immediately cancels scheduled audio buffers and sends an interruption signal.

## Consequences
- **Positive:** Enables meeting the LKR 1.50/min budget target; guarantees ultra-low barge-in latency without server latency.
- **Negative:** AudioWorklet requires careful handling across older browsers and requires HTTPS or localhost.
