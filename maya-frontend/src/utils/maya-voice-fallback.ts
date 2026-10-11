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
 * - Seamless fallback to browser Web Speech API (SpeechSynthesis) if WASM is initializing or unavailable.
 */

import { Platform } from 'react-native';

let cachedVoices: SpeechSynthesisVoice[] = [];
let piperSession: any = null;
let piperConfig: any = null;
let piperG2P: any = null;
let piperInitPromise: Promise<boolean> | null = null;
let activeAudioElement: any = null;
const audioBlobCache = new Map<string, string>();

/**
 * Load browser script asynchronously without bundling through Metro.
 * This guarantees Metro never parses ONNX runtime bundles.
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((window as any).ort) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Retrieve cached ONNX model buffer from IndexedDB to eliminate network requests.
 */
function getCachedModelBuffer(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open('maya-piper-cache', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('models');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('models', 'readonly');
        const getReq = tx.objectStore('models').get('amy');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Cache ONNX model buffer in IndexedDB.
 */
function setCachedModelBuffer(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve();
      const req = indexedDB.open('maya-piper-cache', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('models');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('models', 'readwrite');
        tx.objectStore('models').put(buffer, 'amy');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Encode Float32Array audio samples into standard PCM 16-bit mono WAV.
 */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataByteLength = samples.length * bytesPerSample;
  const headerByteLength = 44;
  const buffer = new ArrayBuffer(headerByteLength + dataByteLength);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const offset = headerByteLength;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset + i * bytesPerSample, int16, true);
  }

  return buffer;
}

/**
 * Initialize / Pre-warm Piper WASM in the browser.
 * Caches model and phonemizer into browser memory / IndexedDB.
 */
export async function initPiper(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (piperSession && piperG2P && piperConfig) {
    return true;
  }
  if (piperInitPromise) {
    return piperInitPromise;
  }

  piperInitPromise = (async () => {
    try {
      // 1. Load ONNX Runtime Web via script tag
      if (!(window as any).ort) {
        await loadScript('/onnx/ort.all.min.js').catch(async () => {
          await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.all.min.js');
        });
      }

      const ort = (window as any).ort;
      if (!ort) {
        throw new Error('onnxruntime-web could not be loaded');
      }

      if (ort?.env?.wasm) {
        ort.env.wasm.wasmPaths = '/onnx/';
        ort.env.wasm.numThreads = 1;
      }

      // 2. Load model config and G2P phonemizer
      // @ts-ignore
      const [{ G2P }, configRes] = await Promise.all([
        // @ts-ignore
        import('@piper-plus/g2p'),
        fetch('/piper/en_US-amy-medium.onnx.json'),
      ]);

      if (!configRes.ok) {
        throw new Error(`Failed to load model config: ${configRes.status}`);
      }

      piperConfig = await configRes.json();
      piperG2P = await G2P.create({ languages: ['en'] });

      // 3. Load ONNX model data (try IndexedDB first, fallback to fetch)
      let modelBuffer = await getCachedModelBuffer();
      if (!modelBuffer) {
        const modelRes = await fetch('/piper/en_US-amy-medium.onnx');
        if (!modelRes.ok) {
          throw new Error(`Failed to fetch ONNX model: ${modelRes.status}`);
        }
        modelBuffer = await modelRes.arrayBuffer();
        setCachedModelBuffer(modelBuffer);
      }

      // 4. Create ONNX inference session
      piperSession = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
      });

      console.log('[MayaVoiceFallback] Piper WASM Amy neural voice engine ready.');
      return true;
    } catch (err) {
      console.warn('[MayaVoiceFallback] Piper WASM init failed; using SpeechSynthesis:', err);
      return false;
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

  // Pre-warm Piper WASM in background
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    initPiper().catch(() => {});
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
  },
  isRetry = false,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
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
      }
    };

    const triggerSpeak = () => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        if (!hasEnded) {
          hasEnded = true;
          options?.onEnd?.();
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
    return false;
  }
}

/**
 * Synthesize and speak text using Piper WASM neural voice (Amy),
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

  // 2. Synthesize directly via client-side WASM if on Web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    initPiper()
      .then(async (ready) => {
        if (!ready || !piperSession || !piperG2P || !piperConfig) {
          speakViaSpeechSynthesis(cleanText, options);
          return;
        }

        try {
          const ort = (window as any).ort;
          const encoded = piperG2P.encode(cleanText, piperConfig.phoneme_id_map, { language: 'en' });
          const phonemeIds = encoded.phonemeIds;

          const feeds = {
            input: new ort.Tensor('int64', new BigInt64Array(phonemeIds.map((id: number) => BigInt(id))), [1, phonemeIds.length]),
            input_lengths: new ort.Tensor('int64', new BigInt64Array([BigInt(phonemeIds.length)]), [1]),
            scales: new ort.Tensor('float32', new Float32Array([0.667, 0.95, 0.8]), [3]),
          };

          const result = await piperSession.run(feeds);
          const sampleRate = piperConfig.audio?.sample_rate || 22050;
          const wavBuffer = encodeWav(result.output.data, sampleRate);
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
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
