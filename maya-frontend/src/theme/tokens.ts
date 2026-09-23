/**
 * Maya AI Design Tokens
 * Extracted from design/inbox/01-onboarding-welcome-mobile.png and responsive standards.
 * Reference: ADR 0004 (Styling Strategy & Design Tokens)
 */

export const Breakpoints = {
  phoneMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
} as const;

export const Colors = {
  brand: {
    primary: '#0085db',
    primaryHover: '#0072bc',
    primaryActive: '#005f9e',
    light: '#e0f2fe',
  },
  text: {
    heading: '#0c1b33',
    body: '#475569',
    muted: '#94a3b8',
    inverse: '#ffffff',
  },
  surface: {
    background: '#ffffff',
    card: '#f8fafc',
    pill: '#ffffff',
    border: '#e2e8f0',
  },
  badges: {
    star: '#f59e0b',
    users: '#0284c7',
    trophy: '#d97706',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const Typography = {
  heading1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800' as const,
  },
  heading2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
} as const;
