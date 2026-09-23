---
trigger: always_on
description: Universal frontend standards (Expo, React Native for Web, Expo Router), responsive design rules, and audio abstraction.
---

# Universal Frontend & Responsive Standards

## 1. Universal Code Rule (Web First, Native Safe)
- **Shared UI Code:** Use only React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, etc.) and official Expo APIs.
- **No Direct DOM Access:** Never use `window`, `document`, or DOM elements in shared code.
- **Platform Separation:** Isolate web-only logic behind `*.web.ts(x)` and native-only logic behind `*.native.ts(x)` files, exposed through a shared, platform-agnostic interface.
- **Expo Tooling:**
  - Route navigation using **Expo Router** (`src/app/` directory).
  - Bundle web using Metro (do NOT use deprecated `@expo/webpack-config`).
  - Always install dependencies using `npx expo install <package>` to pin SDK-compatible versions.

## 2. Responsive Layout Rules (Phone to Desktop)
- **Breakpoints (Tokens):**
  - **Phone:** `< 768 px` (This is the reference mobile-app layout).
  - **Tablet:** `768–1023 px`
  - **Desktop:** `≥ 1024 px`
  - Verify every screen at 360, 390, 768, 1024, and 1440 px widths.
- **Phone Layout:**
  - Faithfully matches the mobile reference image.
  - Uses mobile navigation patterns (e.g., bottom tabs).
- **Tablet / Desktop Derived Layouts:**
  - Centered content container with a constrained maximum width.
  - Multi-column or master-detail layouts where suited (e.g., conversation + scenario/tips side panel; summary + progress side panel).
  - Navigation adapts to sidebar or top navigation bar.
  - Support pointer and keyboard interactions (visible focus states, hover effects, tab order, Enter/Space/Escape keys).
- **Fluid Layouts:**
  - Never use fixed pixel container widths; use flexbox/grid and a centralized `useBreakpoint` hook.
  - Respect mobile browser dynamic viewports (address bar collapse/expand) and safe areas (`react-native-safe-area-context`).
  - Text must scale gracefully and survive 200% zoom / system large-text accessibility settings without clipping.

## 3. Real-Time Audio Architecture
- **Dependency Injection:** Audio components must implement platform-agnostic interfaces:
  - `AudioCapture` (microphone streaming)
  - `AudioPlayer` (playback queue, jitter buffer)
  - `LiveTransport` (WebSocket connection management)
- **Audio Specs for Gemini Live:**
  - Input: 16-bit PCM at 16 kHz.
  - Output: 24 kHz PCM playback.
  - Processing kept off the UI main thread (e.g., AudioWorklet on web).
- **Browser Realities to Guard Against:**
  - AudioContext must be explicitly resumed upon user gesture (critical for iOS Safari).
  - Microphone permission denial, revocation, and lack of hardware mic must be handled gracefully.
  - Tab visibility changes / backgrounding must pause or handle streams cleanly.
  - Headphone connection / Bluetooth audio routing changes must be supported.
- **Client-Side VAD & Barge-In:**
- **Audio Contract Tests:**
  - Maintain `docs/audio-platform-matrix.md` and run shared audio contract tests against web implementation.

## 4. Cross-Platform Typography & Font Resolution (Android vs. Web)
- **The Android Custom Font Trap:**
  - **On Web:** Browsers match fonts using CSS `@font-face` with `fontFamily: 'Outfit'` and `fontWeight: '600' | '700'`.
  - **On Android:** React Native does **NOT** synthesize font weights for custom fonts. Specifying both `fontFamily: 'Outfit_600SemiBold'` AND `fontWeight: '600'` causes Android's font resolver to search for a bold variant of the family named `Outfit_600SemiBold`. Since it does not exist, Android **silently falls back to system Roboto**.
  - **The Strict Rule:** NEVER declare raw `fontFamily` and `fontWeight` pairs inline in component styles.
  - **Mandatory Helper:** Always use `...fontStyle(family, weight)` from `@/theme/fonts` (e.g., `...fontStyle('outfit', 'semiBold')`).
    - Web returns: `{ fontFamily: 'Outfit', fontWeight: '600' }`
    - Native returns: `{ fontFamily: 'Outfit_600SemiBold' }` (NO `fontWeight` property!)
  - Supported families: `'outfit' | 'inter'`.
  - Supported weights: `'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold'`.

## 5. Cross-Platform Image Styling & Effects
- **No `tintColor` on Multi-Color Images / Illustrations:**
  - React Native's `Image` `tintColor` prop/style fills **every non-transparent pixel** with a single solid color.
  - Using `tintColor` on multi-color illustrations (e.g. feature icons, avatars, badges) turns them into flat, solid silhouettes/blobs.
  - For disabled/locked states on illustrations:
    - Web: Use CSS `filter: 'grayscale(100%)'`.
    - Native (Android/iOS): Use reduced opacity (e.g., `opacity: 0.35`) without `tintColor`, or provide a dedicated grayscale image asset.
    - `tintColor` is reserved exclusively for single-color monochrome vector glyphs/masks.
