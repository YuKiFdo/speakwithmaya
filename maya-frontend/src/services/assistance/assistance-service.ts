import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { getAuthHeaders } from '@/services/supabase';

// In-memory frontend caches to prevent redundant network fetches
const translationMemory = new Map<string, string>();
const hintMemory = new Map<string, { hintEnglish: string; hintSinhala: string }>();

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
      const translated = data?.translatedText?.trim() || '';
      if (translated) {
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
 */
export async function fetchHint(
  question: string,
  options?: { topic?: string; level?: string; scenarioId?: string; userName?: string; sessionId?: string }
): Promise<HintResponse | null> {
  const trimmed = (question || '').trim();
  if (!trimmed) return null;

  const cacheKey = `${options?.level || 'all'}:${trimmed}`;
  if (hintMemory.has(cacheKey)) {
    return hintMemory.get(cacheKey)!;
  }

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
      }),
    });

    if (res.ok) {
      const data: HintResponse = await res.json();
      if (data?.hintEnglish && data?.hintSinhala) {
        hintMemory.set(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn('[assistance-service] Error fetching hint:', err);
  }

  return null;
}
