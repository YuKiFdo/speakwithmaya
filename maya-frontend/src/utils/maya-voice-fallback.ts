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

let activeAudioElement: HTMLAudioElement | null = null;
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
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): boolean {
  try {
    stopMayaVoiceFallback();

    const audio = new Audio(blobUrl);
    activeAudioElement = audio;

    if (options?.rate && options.rate > 0) {
      audio.playbackRate = options.rate;
    }

    audio.onplay = () => {
      options?.onStart?.();
    };

    audio.onended = () => {
      if (activeAudioElement === audio) {
        activeAudioElement = null;
      }
      options?.onEnd?.();
    };

    audio.onerror = (e) => {
      if (activeAudioElement === audio) {
        activeAudioElement = null;
      }
      console.warn('[MayaVoice] Audio playback error:', e);
      options?.onError?.(e);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
        }
        console.warn('[MayaVoice] audio.play() promise rejected:', err);
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
  const cleanText = (text || '').trim();
  if (!cleanText) {
    options?.onEnd?.();
    return true;
  }

  // 1. Check in-memory audio blob cache for instant 0ms playback
  const cachedUrl = audioBlobCache.get(cleanText);
  if (cachedUrl) {
    return playAudioBlob(cachedUrl, options);
  }

  // 2. Synthesize via self-hosted Backend Piper TTS
  const backendBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  if (typeof window !== 'undefined') {
    fetch(`${backendBaseUrl}/v1/sessions/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice: 'Amy' }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data?.audioBase64) {
          throw new Error('Empty audioBase64 from backend');
        }

        // Convert base64 to WAV Blob URL
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        const blobUrl = URL.createObjectURL(blob);

        audioBlobCache.set(cleanText, blobUrl);
        playAudioBlob(blobUrl, options);
      })
      .catch((err) => {
        console.warn('[MayaVoice] Backend TTS request failed:', err);
        options?.onError?.(err);
      });

    return true;
  }

  return false;
}

export function stopMayaVoiceFallback(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }
}
