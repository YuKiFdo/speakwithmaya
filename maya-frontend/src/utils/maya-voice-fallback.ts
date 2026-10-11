/**
 * Maya Voice Fallback & Neural Client TTS (Piper WASM + Web Speech API)
 *
 * Provides high-quality neural voice synthesis directly in the browser via Piper WASM (Amy voice),
 * matching Gemini's "Callirrhoe" conversational tone across all platforms (Android, Windows, macOS, iOS)
 * with zero backend Gemini TTS API quota consumption.
 *
 * Features:
 * - Direct client-side WebAssembly inference (Piper Amy 22kHz ONNX).
 * - Automatic IndexedDB caching for fast repeated playback without network downloads.
 * - In-memory Blob URL caching for instant 0ms audio replays on review screens.
 * - Graceful fallback to browser Web Speech API (SpeechSynthesis) if WASM is initializing or unavailable.
 */

import { Platform } from 'react-native';

let cachedVoices: SpeechSynthesisVoice[] = [];
let piperInstance: any = null;
let piperInitPromise: Promise<any> | null = null;
let activeAudioElement: any = null;
const audioBlobCache = new Map<string, string>();

/**
 * Initialize / Pre-warm Piper WASM in the browser.
 * Caches model and phonemizer into browser memory / IndexedDB.
 */
export async function getPiperInstance(): Promise<any> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  if (piperInstance) {
    return piperInstance;
  }
  if (piperInitPromise) {
    return piperInitPromise;
  }

  piperInitPromise = (async () => {
    try {
      // Dynamic imports prevent Node.js / SSR / Native bundle breakages
      const [ortModule, piperModule] = await Promise.all([
        import('onnxruntime-web'),
        import('piper-plus'),
      ]);

      const ort = (ortModule as any).default || ortModule;
      if (ort?.env?.wasm) {
        ort.env.wasm.wasmPaths = '/onnx/';
        ort.env.wasm.numThreads = 1;
      }
      (globalThis as any).ort = ort;

      const PiperPlus = piperModule.PiperPlus;
      const modelUrl = `${window.location.origin}/piper/en_US-amy-medium.onnx`;

      const piper = await PiperPlus.initialize({
        model: modelUrl,
        ort,
      });

      piperInstance = piper;
      console.log('[MayaVoiceFallback] Piper WASM (Amy voice) initialized successfully in browser.');
      return piper;
    } catch (err) {
      console.warn('[MayaVoiceFallback] Piper WASM initialization failed; will fall back to SpeechSynthesis:', err);
      return null;
    } finally {
      piperInitPromise = null;
    }
  })();

  return piperInitPromise;
}

export function warmUpSpeechVoices(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        cachedVoices = voices;
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}
  }

  // Pre-warm Piper WASM in background so review screens have 0ms latency
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    getPiperInstance().catch(() => {});
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  warmUpSpeechVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    warmUpSpeechVoices();
  };
}

// Preferred browser voices for Web Speech API fallback
const PREFERRED_CALLIRRHOE_VOICE_NAMES = [
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Michelle Online (Natural) - English (United States)',
  'Microsoft Jenny - English (United States)',
  'Microsoft Aria - English (United States)',
  'Microsoft Zira - English (United States)',
  'Google US English',
  'Google UK English Female',
  'Google English (United States)',
  'Samantha (Enhanced)',
  'Samantha',
  'Ava (Premium)',
  'Ava',
  'Allison (Enhanced)',
  'Allison',
  'Zoe (Enhanced)',
  'Zoe',
  'Karen',
  'Victoria',
];

export function getBestCallirrhoeVoice(preferLocal = false): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  if (preferLocal) {
    const localPreferred = voices.find(
      (v) =>
        v.localService === true &&
        (v.lang.startsWith('en-US') || v.lang.startsWith('en_US')) &&
        !v.name.toLowerCase().includes('male'),
    );
    if (localPreferred) return localPreferred;

    const anyLocalEn = voices.find(
      (v) => v.localService === true && v.lang.startsWith('en'),
    );
    if (anyLocalEn) return anyLocalEn;

    const zira = voices.find((v) => v.name.toLowerCase().includes('zira'));
    if (zira) return zira;
  }

  for (const preferred of PREFERRED_CALLIRRHOE_VOICE_NAMES) {
    const match = voices.find(
      (v) =>
        v.name.toLowerCase() === preferred.toLowerCase() ||
        v.name.toLowerCase().includes(preferred.toLowerCase()),
    );
    if (match) return match;
  }

  const usFemale = voices.find((v) => {
    const langMatch = v.lang.startsWith('en-US') || v.lang.startsWith('en_US');
    const nameLower = v.name.toLowerCase();
    const isFemale =
      nameLower.includes('female') ||
      nameLower.includes('woman') ||
      nameLower.includes('jenny') ||
      nameLower.includes('aria') ||
      nameLower.includes('samantha') ||
      nameLower.includes('ava') ||
      nameLower.includes('zira');
    return langMatch && isFemale;
  });
  if (usFemale) return usFemale;

  const usGeneral =
    voices.find((v) => {
      const langMatch = v.lang.startsWith('en-US') || v.lang.startsWith('en_US');
      const isMale =
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('guy') ||
        v.name.toLowerCase().includes('george');
      return langMatch && !isMale;
    }) || voices.find((v) => v.lang.startsWith('en-US') || v.lang.startsWith('en_US'));

  if (usGeneral) return usGeneral;
  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
}

/**
 * Play an existing audio blob URL via HTMLAudioElement.
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
      console.warn('[MayaVoiceFallback] HTMLAudioElement playback error:', e);
      options?.onError?.(e);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
        }
        console.warn('[MayaVoiceFallback] audio.play() promise rejected:', err);
        options?.onError?.(err);
      });
    }

    return true;
  } catch (err) {
    console.warn('[MayaVoiceFallback] playAudioBlob exception:', err);
    options?.onError?.(err);
    return false;
  }
}

/**
 * Fallback Web Speech API speech synthesis
 */
function speakViaSpeechSynthesis(
  cleanText: string,
  options?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
  isRetry = false,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.(new Error('SpeechSynthesis not supported'));
    return false;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getBestCallirrhoeVoice(isRetry);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = options?.rate ?? 1.10;
    utterance.pitch = options?.pitch ?? 1.04;
    utterance.volume = 1.0;

    let hasEnded = false;
    let keepAliveTimer: any = null;

    utterance.onstart = () => {
      options?.onStart?.();
      keepAliveTimer = setInterval(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (!window.speechSynthesis.speaking) {
            clearInterval(keepAliveTimer);
          } else {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }
      }, 5000);
    };

    utterance.onend = () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (!hasEnded) {
        hasEnded = true;
        options?.onEnd?.();
      }
    };

    utterance.onerror = (e) => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (!hasEnded) {
        hasEnded = true;
        if (
          !isRetry &&
          (e.error === 'synthesis-failed' || e.error === 'network' || e.error === 'audio-busy')
        ) {
          try {
            window.speechSynthesis.cancel();
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
          } catch {}
          setTimeout(() => {
            speakViaSpeechSynthesis(cleanText, options, true);
          }, 120);
          return;
        }

        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[MayaVoiceFallback] Synthesis error:', e.error);
        }
        options?.onError?.(e);
      }
    };

    const triggerSpeak = () => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        if (!hasEnded) {
          hasEnded = true;
          options?.onError?.(err);
        }
      }
    };

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      setTimeout(triggerSpeak, 120);
    } else {
      triggerSpeak();
    }

    return true;
  } catch (err) {
    console.warn('[MayaVoiceFallback] Failed to speak:', err);
    options?.onError?.(err);
    return false;
  }
}

/**
 * Main entrance: Synthesizes and speaks text using Piper WASM neural voice (Amy),
 * with instant Blob URL caching and SpeechSynthesis fallback.
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
  _isRetry = false,
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

  // 2. If Piper instance is available, synthesize directly via client-side WASM
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    getPiperInstance()
      .then(async (piper) => {
        if (!piper) {
          speakViaSpeechSynthesis(cleanText, options);
          return;
        }

        try {
          const result = await piper.synthesize(cleanText, {
            language: 'en',
            noiseScale: 0.667,
            lengthScale: 0.95,
          });

          const blob = result.toBlob();
          const blobUrl = URL.createObjectURL(blob);
          audioBlobCache.set(cleanText, blobUrl);

          playAudioBlob(blobUrl, options);
        } catch (synthErr) {
          console.warn('[MayaVoiceFallback] Piper synthesis failed, falling back to Web Speech:', synthErr);
          speakViaSpeechSynthesis(cleanText, options);
        }
      })
      .catch((err) => {
        console.warn('[MayaVoiceFallback] Piper async call failed, falling back to Web Speech:', err);
        speakViaSpeechSynthesis(cleanText, options);
      });

    return true;
  }

  // 3. Fallback to SpeechSynthesis
  return speakViaSpeechSynthesis(cleanText, options);
}

export function stopMayaVoiceFallback(): void {
  // Stop active HTMLAudioElement if Piper audio is playing
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }

  // Stop browser SpeechSynthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}
  }
}
