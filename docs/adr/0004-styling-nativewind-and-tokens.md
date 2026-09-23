# ADR 0004: Styling Strategy with NativeWind v4 and Shared Design Tokens

## Status
Accepted

## Context
The client application must run on web (responsive from 360 px phone up to 1440 px+ desktop) and later compile to native iOS and Android (Phase 11).
The user requested **NativeWind** for styling.
Hard constraints:
- Universal code rules: React Native primitives only (`View`, `Text`, `Pressable`, etc.).
- Responsive breakpoints: Phone `< 768 px`, Tablet `768–1023 px`, Desktop `≥ 1024 px`.
- Design fidelity: Tokens must align with screen images delivered in `design/inbox/`.

## Decision
1. **Tooling:** Adopt **NativeWind v4** (`nativewind@^4.2.7` with `tailwindcss@^3.4.17`), which is fully compatible with Expo SDK 57, React 19, and React Native 0.86.
2. **Tokens Module (`src/theme/tokens.ts`):** Central source of truth for:
   - Primary brand color: `#0085db` (extracted from onboarding CTA button)
   - Backgrounds: `#ffffff`
   - Typography colors: `#0f172a` (primary text), `#475569` (body text)
   - Pill badge styles & shadows
   - Breakpoints: `phone: 768px`, `tablet: 1024px`
3. **Tailwind Config (`tailwind.config.js`):** Extends theme using the design tokens to provide utility classes across components (`className="bg-primary text-white rounded-full ..."`).
4. **Layout Switching:** Centralized `useBreakpoint()` hook drives structural layout differences (bottom tabs on phone vs sidebar on desktop).

## Consequences
- **Positive:** Fast, readable styling workflow; responsive utility classes (`md:flex-row`, `lg:max-w-4xl`); universal across web and mobile.
- **Negative:** Babel/Metro configuration must be correctly wired for CSS interop.
