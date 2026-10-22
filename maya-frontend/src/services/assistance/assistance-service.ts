import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { getAuthHeaders } from '@/services/supabase';

// In-memory frontend caches to prevent redundant network fetches
const translationMemory = new Map<string, string>();
const hintMemory = new Map<string, HintResponse>();
const inFlightHintPromises = new Map<string, Promise<HintResponse | null>>();

const FORBIDDEN_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0900-\u097F\u0590-\u05FF\u0980-\u0CFF\u0D00-\u0D7F]/;
const FORBIDDEN_TAMIL_WORDS_REGEX = /தேவையான|வணக்கம்|ரொம்ப/;
const SINHALA_SCRIPT_REGEX = /[\u0D80-\u0DFF]/;

export function sanitizeSinhalaText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/தேவையான/g, 'අවශ්‍ය')
    .replace(/வணக்கம்/g, 'ආයුබෝවන්')
    .replace(/[\u0B80-\u0BFF\u0900-\u097F\u0600-\u06FF\u0980-\u0CFF\u0D00-\u0D7F]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isValidSinhalaText(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    SINHALA_SCRIPT_REGEX.test(trimmed) &&
    !FORBIDDEN_SCRIPT_REGEX.test(trimmed) &&
    !FORBIDDEN_TAMIL_WORDS_REGEX.test(trimmed)
  );
}

export interface HintResponse {
  hintEnglish: string;
  hintSinhala: string;
}

/**
 * Fetches Sinhala translation for the specified English prompt text.
 */
export async function fetchTranslation(text: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  if (translationMemory.has(trimmed)) {
    return translationMemory.get(trimmed)!;
  }

  try {
    const backendBaseUrl = getBackendBaseUrl();
    const authHeaders = await getAuthHeaders();

    const res = await fetch(`${backendBaseUrl}/v1/sessions/translate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        text: trimmed,
        targetLang: 'si',
        sourceLang: 'en',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      let translated = sanitizeSinhalaText(data?.translatedText?.trim() || '');
      if (translated) {
        if (!isValidSinhalaText(translated)) {
          console.warn('[assistance-service] Translation contained invalid or non-Sinhala script:', translated);
          return '';
        }
        translationMemory.set(trimmed, translated);
        return translated;
      }
    }
  } catch (err) {
    console.warn('[assistance-service] Error fetching translation:', err);
  }

  return '';
}

/**
 * Generates an English suggested reply and its Sinhala translation
 * for Maya's current spoken question.
 * Uses in-flight deduplication and normalized caching to guarantee
 * only one fetch happens per prompt.
 */
export async function fetchHint(
  question: string,
  options?: {
    topic?: string;
    level?: string;
    scenarioId?: string;
    userName?: string;
    sessionId?: string;
    isPrefetch?: boolean;
  }
): Promise<HintResponse | null> {
  const trimmed = (question || '').trim();
  if (!trimmed) return null;

  const normQuestion = trimmed.toLowerCase().replace(/[?!.,]/g, '').trim();
  const cacheKey = `${options?.level || 'all'}:${normQuestion}`;

  if (hintMemory.has(cacheKey)) {
    return hintMemory.get(cacheKey)!;
  }

  // If a request for this exact question is already pending, reuse the same promise
  if (inFlightHintPromises.has(cacheKey)) {
    return inFlightHintPromises.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const backendBaseUrl = getBackendBaseUrl();
      const authHeaders = await getAuthHeaders();

      const res = await fetch(`${backendBaseUrl}/v1/sessions/hint`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          question: trimmed,
          sessionId: options?.sessionId,
          topic: options?.topic,
          level: options?.level,
          scenarioId: options?.scenarioId,
          userName: options?.userName,
          isPrefetch: options?.isPrefetch,
        }),
      });

      if (res.ok) {
        const data: HintResponse = await res.json();
        if (data?.hintEnglish) {
          let sinhala = sanitizeSinhalaText(data.hintSinhala || '');
          if (sinhala && !isValidSinhalaText(sinhala)) {
            console.warn('[assistance-service] hintSinhala contained invalid or foreign script, clearing:', sinhala);
            sinhala = '';
          }
          const sanitized: HintResponse = {
            hintEnglish: data.hintEnglish.trim(),
            hintSinhala: sinhala,
          };
          hintMemory.set(cacheKey, sanitized);
          return sanitized;
        }
      }
    } catch (err) {
      console.warn('[assistance-service] Error fetching hint:', err);
    } finally {
      inFlightHintPromises.delete(cacheKey);
    }
    return null;
  })();

  inFlightHintPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}
