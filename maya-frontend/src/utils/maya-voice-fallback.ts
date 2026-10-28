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

  // 2. Synthesize via self-hosted Backend Piper TTS
  const backendBaseUrl = getBackendBaseUrl();
  if (typeof window !== 'undefined') {
    const abortController = new AbortController();
    activeAbortController = abortController;
    activeOnEndCallback = options?.onEnd || null;

    fetch(`${backendBaseUrl}/v1/sessions/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice: 'Amy' }),
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data?.audioBase64) {
          throw new Error('Empty audioBase64 from backend');
        }

        // Convert base64 to WAV Blob URL (still cache it even if stopped so next time is instant)
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        const blobUrl = URL.createObjectURL(blob);

        audioBlobCache.set(cleanText, blobUrl);

        // Do NOT play if this speech request was stopped or superseded while fetching
        if (requestId !== currentSpeechRequestId || abortController.signal.aborted) {
          return;
        }

        if (activeAbortController === abortController) {
          activeAbortController = null;
        }

        playAudioBlob(blobUrl, requestId, options);
      })
      .catch((err) => {
        if (activeAbortController === abortController) {
          activeAbortController = null;
        }
        if (err?.name === 'AbortError' || requestId !== currentSpeechRequestId) {
          return;
        }
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
