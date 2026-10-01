# Maya AI — Technical Facts Ledger (`docs/facts.md`)

*Recorded per Phase 0 specifications. Every external fact is verified against official documentation with dates and source URLs.*
*Date fetched: September 21, 2026*

---

## 1. Google Gemini Live API Facts

| Dimension | Verified Fact | Source URL |
| :--- | :--- | :--- |
| **Recommended Conversational Live Model** | `gemini-3.8-live` (Full bidirectional speech agent with `response_modalities: ["AUDIO"]`) | [Gemini Live API Guide](https://ai.google.dev/gemini-api/docs/live-api) |
| **Live Transcription Model** | `gemini-3.5-transcribe-live` (Dedicated speech-to-text pipeline, `response_modalities: ["TEXT"]`, supports `mode: "SMART" \| "VERBATIM"`, `custom_vocabulary`, automatic language detection) | [Gemini 3.5 Transcribe Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe) |
| **Fallback Live Model** | `gemini-3.1-flash-live-preview` / `gemini-2.5-flash-native-audio-preview-12-2025` | [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| **WebSocket Connection Endpoint** | `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}` | [Gemini Live WebSocket Docs](https://ai.google.dev/gemini-api/docs/live-api) |
| **Audio Input Format** | Raw 16-bit linear PCM, 16 kHz sample rate, little-endian, mono (`audio/pcm;rate=16000`), sent in chunks of ~100ms via `realtimeInput.audio: { data, mimeType }` | [Live API Audio Reference](https://ai.google.dev/gemini-api/docs/live-api) |
| **Audio Output Format** | 24 kHz linear PCM audio stream (`audio/pcm;rate=24000`) emitted via `serverContent.modelTurn.parts[].inlineData.data` | [Live API Audio Reference](https://ai.google.dev/gemini-api/docs/live-api) |
| **Stream Termination Signal** | Client signals utterance completion or end of stream via `realtimeInput: { audioStreamEnd: true }` | [Gemini Live Capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) |
| **Non-Blocking Tool Calling** | Tool declarations support `behavior: "NON_BLOCKING"` to execute grammar evaluation and UI actions asynchronously without halting voice dialogue. Client responds with `scheduling: "WHEN_IDLE"` | [Live API Tool Use](https://ai.google.dev/gemini-api/docs/live-api/tools) |
| **Transcriptions (Interim & Final)** | Emits `interim_input_transcription` (low-latency partial updates for UI subtitle preview) and `input_transcription` (authoritative committed text) | [Live API Transcription Docs](https://ai.google.dev/gemini-api/docs/live-api) |
| **Audio Input Pricing** | **$3.00 per 1M tokens** (equivalent to approximately **$0.005 per minute** of audio streamed) | [Gemini 3.1 Flash Live Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-31-flash-live-preview) |
| **Audio Output Pricing** | **$12.00 per 1M tokens** (equivalent to approximately **$0.018 per minute** of audio generated) | [Gemini 3.1 Flash Live Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-31-flash-live-preview) |
| **Text Input Pricing** | $0.75 per 1M tokens | [Gemini 3.1 Flash Live Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-31-flash-live-preview) |
| **Text Output Pricing** | $4.50 per 1M tokens | [Gemini 3.1 Flash Live Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-31-flash-live-preview) |
| **Audio Token Rate (In)** | ~25 tokens per second (~1,500 tokens/minute) | [Gemini Audio Tokens](https://ai.google.dev/gemini-api/docs/tokens) |
| **Audio Token Rate (Out)** | ~30–35 tokens per second (~1,800–2,100 tokens/minute) | [Gemini Audio Tokens](https://ai.google.dev/gemini-api/docs/tokens) |
| **Session Resumption** | Supported via `sessionResumption: {}` configuration; allows reconnecting a session every 10 minutes | [Session Resumption Guide](https://ai.google.dev/gemini-api/docs/live-session#session-resumption) |
| **`mediaChunks` Deprecation** | `realtimeInput.mediaChunks[]` is **DEPRECATED** — use `audio`, `video`, or `text` fields instead. Multiple mediaChunks not supported; only first processed. May cause Error 1007. | [Live API Reference - BidiGenerateContentRealtimeInput](https://ai.google.dev/api/live#BidiGenerateContentRealtimeInput) |
| **`automaticActivityDetection`** | Server-side VAD config: `disabled` (bool), `startOfSpeechSensitivity` (HIGH/LOW), `endOfSpeechSensitivity` (HIGH/LOW), `prefixPaddingMs` (int32), `silenceDurationMs` (int32). Enabled by default. | [Live API Reference - AutomaticActivityDetection](https://ai.google.dev/api/live#AutomaticActivityDetection) |
| **`audioStreamEnd` Signal** | Signals mic turned off/paused. Only for use with automatic activity detection enabled. Client can reopen stream by sending audio. Use to flush cached audio on mic pause >1s. | [Live API Reference - BidiGenerateContentRealtimeInput](https://ai.google.dev/api/live#BidiGenerateContentRealtimeInput) |
| **`contextWindowCompression`** | `triggerTokens` sets when compression fires; `slidingWindow.targetTokens` defaults to `triggerTokens/2`. System instructions and `prefixTurns` are protected from eviction. | [Live API Reference - SlidingWindow](https://ai.google.dev/api/live#SlidingWindow) |
| **Session Lifetime (No Compression)** | Audio-only: 15 min. Audio+video: 2 min. With compression: unlimited. Connection lifetime: ~10 min (use session resumption). | [Session Management Guide](https://ai.google.dev/gemini-api/docs/live-api/session-management#session-lifetime) |
| **`proactiveAudio`** | Allows model to reject responding to irrelevant audio. Permanently enabled by default on Gemini 3.8 Live (setting `false` will error). v1beta API. | [Live API Capabilities - Proactive Audio](https://ai.google.dev/gemini-api/docs/live-api/capabilities#proactive-audio) |
| **`affectiveDialog`** | Lets Gemini adapt its response style to the input expression and tone. Set `apiVersion: "v1beta"` and `enableAffectiveDialog: true` inside `generationConfig`. Supported on `gemini-3.8-live` (not supported on `gemini-3.1-flash-live`). | [Gemini Live API Capabilities - Affective Dialog](https://ai.google.dev/gemini-api/docs/live-api/capabilities#affective-dialog) |
| **`responseTokensDetails`** | Output token breakdown array in `usageMetadata` returning modality-specific token counts (`AUDIO`, `TEXT`). | [Gemini Live API Reference - UsageMetadata](https://ai.google.dev/api/live#usagemetadata) |

### Ephemeral Token Architecture (Browser Client Direct Connection)
1. **Server-Side Token Minting Endpoint:**
   - Method: `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens` (or SDK `client.authTokens.create`)
   - Configuration lock:
     ```json
     {
       "uses": 1,
       "expireTime": "<timestamp + 30m>",
       "newSessionExpireTime": "<timestamp + 1m>",
       "liveConnectConstraints": {
         "model": "models/gemini-3.1-flash-live-preview",
         "config": {
           "sessionResumption": {},
           "responseModalities": ["AUDIO"]
         }
       }
     }
     ```
2. **Browser WebSocket URL:**
   - Direct connection:
     `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token={ephemeral-token}`
   - **Zero master API keys** are exposed in client code or network inspection.

---

## 2. Expo, React Native for Web & Metro Facts

| Dimension | Verified Fact | Source URL |
| :--- | :--- | :--- |
| **Expo SDK Version** | Pinned to `~57.0.24` | [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) |
| **React / RN Versions** | React `19.2.3`, React Native `0.86.3` | [React Native Releases](https://github.com/facebook/react-native/releases) |
| **Web Bundler** | Metro (`@expo/metro-runtime`). `@expo/webpack-config` is **deprecated** and must not be used. | [Expo Web Bundling](https://docs.expo.dev/guides/customizing-metro/) |
| **Web Output Mode** | `web.output: "static"` configured in `app.json` for static export via `npx expo export --platform web` | [Expo Web Output](https://docs.expo.dev/router/reference/api-routes/) |
| **Navigation** | Expo Router v57 (`src/app/` file-based routing) | [Expo Router](https://docs.expo.dev/router/introduction/) |
| **Styling** | NativeWind v4 (`4.2.7`) with Tailwind CSS v3 (`3.4.17`) compatible with Expo SDK 57 & React 19 | [NativeWind v4 Docs](https://www.nativewind.dev/) |
| **Custom Fonts (Native vs Web)** | On Android/iOS: React Native does **not** synthesize weights for custom fonts. Combining `fontFamily: 'Outfit_600SemiBold'` with `fontWeight: '600'` causes Android to silently fall back to Roboto. Solution: `fontStyle(family, weight)` in `@/theme/fonts` returns `fontFamily` only on native, and `fontFamily` + `fontWeight` on web. | [React Native Custom Fonts & Android Resolver](https://reactnative.dev/docs/text#fontfamily) |
| **Image Tinting Limitation** | React Native `Image` `tintColor` fills all non-transparent pixels with solid color (flat silhouette). It must NOT be used to grayscale multi-color illustrations/photos. Web uses CSS `filter: grayscale(100%)`; native uses reduced opacity (`opacity: 0.35`). | [React Native Image tintColor](https://reactnative.dev/docs/image#tintcolor) |

---

## 3. Web vs Native Audio Comparison Matrix

| Audio Dimension | Web Platform (Phase 0–10) | Native Platform (iOS / Android, Phase 11) | Notes & Strategy |
| :--- | :--- | :--- | :--- |
| **Permission Model** | `navigator.mediaDevices.getUserMedia({ audio: true })`. Browser prompts user with permission dialog. | iOS: `NSMicrophoneUsageDescription` in `Info.plist`. Android: `RECORD_AUDIO` in `AndroidManifest.xml`. | Abstracted behind `AudioCapture.requestPermission()` |
| **User Gesture Requirement** | `AudioContext` starts in `suspended` state in modern browsers (especially iOS Safari); **must** be resumed on user gesture (e.g., tap "Start"). | Native audio sessions do not require a DOM user gesture, but require OS audio session activation. | Always trigger `AudioContext.resume()` on the primary "Start Speaking" button press |
| **Secure Context Requirement** | `getUserMedia` requires secure context (`https://` or `localhost`). Unsecured `http://` throws `TypeError`. | Native apps have direct hardware device access via OS APIs. | Enforce HTTPS everywhere in web deployment |
| **Audio Processing Pipeline** | Web Audio API + `AudioWorkletNode` for zero-jitter, off-main-thread capture and 16 kHz PCM chunking. | Native Audio Queue / AAudio / Oboe / Expo AV development build. | Shared interface `AudioCapture` |
| **Native Hardware Sample Rate** | Typically 44.1 kHz or 48 kHz. | 44.1 kHz or 48 kHz standard. | Downsampled to 16 kHz in worker/worklet using linear interpolation or sinc filter |
| **Echo Cancellation & Noise Suppression** | Pass `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }` to `getUserMedia`. | Handled by OS voice chat processing mode (`VoiceProcessingIO` on iOS, `VOICE_COMMUNICATION` on Android). | Critical to prevent AI speaker output leaking back into microphone |
| **Interruption Handling** | Window blur, tab backgrounding, incoming WebRTC / media playback pauses or drops frames. | Native incoming phone call, alarm, or other audio app triggers interruption listener. | Listen to `visibilitychange` on web; pause transmission or mute stream cleanly |
| **Audio Routing / Devices** | `navigator.mediaDevices.enumerateDevices()` + `devicechange` event for headphone / Bluetooth changes. | `AVAudioSessionRouteChangeNotification` (iOS) / `AudioManager` broadcast receiver (Android). | Auto-detect device switch without dropping WebSocket session |
| **Barge-In Handling** | Client VAD detects energy onset $\rightarrow$ immediately stops `AudioContext` playback node ($\le 300\text{ ms}$). | Native player buffer flush immediately upon voice detected. | Target latency $< 300\text{ ms}$ |

---

## 4. NestJS Backend & Testing Facts

| Dimension | Verified Fact | Source URL |
| :--- | :--- | :--- |
| **NestJS Core Version** | `@nestjs/core ^12.0.1`, `@nestjs/common ^12.0.1`, `@nestjs/platform-express ^12.0.1` | [NestJS Documentation](https://docs.nestjs.com/) |
| **Test Runner** | Vitest `^4.1.2` (`vitest run` and `vitest run --config ./vitest.config.e2e.ts`) | [Vitest Docs](https://vitest.dev/) |
| **Validation** | `class-validator` & `class-transformer` via global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) | [NestJS Validation](https://docs.nestjs.com/techniques/validation) |
| **Security Headers** | Helmet (`helmet`), strict CORS origin allowlist | [NestJS Security](https://docs.nestjs.com/security/cors) |
| **Playwright Version** | Playwright `^1.50.0` with Desktop Chromium, Mobile Chromium (Pixel 7), Mobile WebKit (iPhone 14) | [Playwright Docs](https://playwright.dev/) |
