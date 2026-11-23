import type { TourLang } from './tour-types';

/**
 * Tour language follows the learner's native language from onboarding.
 * (language_mode is not used: the client defaults it to 'english_only' when it is missing,
 * so it would hide the Sinhala / Tamil tour from most learners.)
 */
export function resolveTourLanguage(nativeLanguage?: string | null): TourLang {
  const lang = (nativeLanguage || '').toLowerCase();
  if (lang === 'sinhala' || lang === 'si') return 'si';
  if (lang === 'tamil' || lang === 'ta') return 'ta';
  return 'en';
}

/** Replaces {name}-style placeholders; a missing value removes the placeholder cleanly. */
export function fillTourVars(text: string, vars?: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (_, key: string) => (vars?.[key] ?? '').trim())
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
