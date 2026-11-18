/**
 * Maya Voice Synthesis (Backend Piper Neural TTS Engine)
 *
 * Exclusively uses the self-hosted Piper TTS (Amy voice) running on the NestJS backend.
 * Provides identical, consistent, high-fidelity neural voice across all platforms
 * (Android, iOS, Windows, macOS, Linux) with zero browser speech synthesis fallbacks.
 *
 * Features:
 * - 100% Backend Piper neural audio.
 * - In-memory audio Blob URL cache for instant 0ms replays.
 * - Standard HTMLAudioElement playback with play/pause/ended lifecycle hooks.
 * - Zero external Google/Gemini API rate limits or quota consumption.
 */

import { getBackendBaseUrl } from '@/hooks/useLiveCall';

let activeAudioElement: HTMLAudioElement | null = null;
let activeAbortController: AbortController | null = null;
let activeOnEndCallback: (() => void) | null = null;
let currentSpeechRequestId = 0;
const audioBlobCache = new Map<string, string>();

/**
 * Kept as a no-op for compatibility with onboarding screen pre-warming hooks.
 */
export function warmUpSpeechVoices(): void {}

export function getBestCallirrhoeVoice(): null {
  return null;
}

/**
 * Play an audio Blob URL via HTMLAudioElement.
 */
function playAudioBlob(
  blobUrl: string,
  requestId: number,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): boolean {
  if (requestId !== currentSpeechRequestId) {
    options?.onEnd?.();
    return false;
  }

  try {
    if (activeAudioElement) {
      try {
        activeAudioElement.onplay = null;
        activeAudioElement.onended = null;
        activeAudioElement.onerror = null;
        activeAudioElement.pause();
        activeAudioElement.currentTime = 0;
      } catch {}
      activeAudioElement = null;
    }

    const audio = new Audio(blobUrl);
    activeAudioElement = audio;
    activeOnEndCallback = options?.onEnd || null;

    if (options?.rate && options.rate > 0) {
      audio.playbackRate = options.rate;
    }

    audio.onplay = () => {
      if (requestId !== currentSpeechRequestId) {
        try {
          audio.pause();
        } catch {}
        return;
      }
      options?.onStart?.();
    };

    audio.onended = () => {
      if (activeAudioElement === audio) {
        activeAudioElement = null;
        activeOnEndCallback = null;
      }
      options?.onEnd?.();
    };

    audio.onerror = (e) => {
      if (activeAudioElement === audio) {
        activeAudioElement = null;
        activeOnEndCallback = null;
      }
      console.warn('[MayaVoice] Audio playback error:', e);
      options?.onError?.(e);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
          activeOnEndCallback = null;
        }
        if (requestId === currentSpeechRequestId) {
          console.warn('[MayaVoice] audio.play() promise rejected:', err);
        }
        options?.onError?.(err);
      });
    }

    return true;
  } catch (err) {
    console.warn('[MayaVoice] playAudioBlob exception:', err);
    options?.onError?.(err);
    return false;
  }
}

/**
 * Main entrance: Always synthesizes speech using the self-hosted Backend Piper TTS,
 * with instant in-memory Blob caching.
 */
export function speakAsCallirrhoe(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): boolean {
  // Cancel any previous playback or in-flight TTS fetch first
  stopMayaVoiceFallback();

  const cleanText = (text || '').trim();
  if (!cleanText) {
    options?.onEnd?.();
    return true;
  }

  const requestId = ++currentSpeechRequestId;

  // 1. Check in-memory audio blob cache for instant 0ms playback
  const cachedUrl = audioBlobCache.get(cleanText);
  if (cachedUrl) {
    return playAudioBlob(cachedUrl, requestId, options);
  }

  // 2. Synthesize via self-hosted Backend Piper TTS (shares an in-flight prefetch if any)
  if (typeof window !== 'undefined') {
    activeOnEndCallback = options?.onEnd || null;

    fetchMayaVoiceUrl(cleanText)
      .then((blobUrl) => {
        // Do NOT play if this speech request was stopped or superseded while fetching
        if (requestId !== currentSpeechRequestId) return;
        playAudioBlob(blobUrl, requestId, options);
      })
      .catch((err) => {
        if (requestId !== currentSpeechRequestId) return;
        if (activeOnEndCallback === options?.onEnd) {
          activeOnEndCallback = null;
        }
        console.warn('[MayaVoice] Backend TTS request failed:', err);
        options?.onError?.(err);
      });

    return true;
  }

  return false;
}

/**
 * Fetches (or reuses) the backend Piper clip for `text` and returns a blob: URL.
 * Concurrent callers for the same text share one request, so a prefetch started on the
 * analyzing screen is picked up by the feedback screen instead of being requested twice.
 * The request is never aborted by stopMayaVoiceFallback(): a stopped clip is still cached.
 */
const inFlightVoice = new Map<string, Promise<string>>();

function fetchMayaVoiceUrl(text: string): Promise<string> {
  const cached = audioBlobCache.get(text);
  if (cached) return Promise.resolve(cached);
  const pending = inFlightVoice.get(text);
  if (pending) return pending;

  const task = (async () => {
    const res = await fetch(`${getBackendBaseUrl()}/v1/sessions/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'Amy' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.audioBase64) throw new Error('Empty audioBase64 from backend');

    const byteCharacters = atob(data.audioBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blobUrl = URL.createObjectURL(new Blob([byteArray], { type: 'audio/wav' }));
    audioBlobCache.set(text, blobUrl);
    return blobUrl;
  })().finally(() => {
    inFlightVoice.delete(text);
  });

  inFlightVoice.set(text, task);
  return task;
}

/** True when `text` can play immediately (already synthesized and downloaded). */
export function isMayaVoiceCached(text: string): boolean {
  return audioBlobCache.has((text || '').trim());
}

/**
 * Downloads clips ahead of time so they play instantly later. Resolves when all are cached
 * or `timeoutMs` elapses, whichever comes first (never rejects). Requests keep running in
 * the background after a timeout and still land in the cache.
 */
export function prefetchMayaVoice(texts: string[], timeoutMs = 20000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const unique = [...new Set(texts.map((t) => (t || '').trim()).filter(Boolean))];
  if (unique.length === 0) return Promise.resolve();
  const all = Promise.allSettled(unique.map((t) => fetchMayaVoiceUrl(t))).then(() => undefined);
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export function stopMayaVoiceFallback(): void {
  currentSpeechRequestId++;

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {}
    activeAbortController = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.onplay = null;
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }

  if (activeOnEndCallback) {
    const cb = activeOnEndCallback;
    activeOnEndCallback = null;
    try {
      cb();
    } catch {}
  }
}
