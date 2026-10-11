/**
 * Maya Voice Fallback (Web Speech API)
 *
 * Emulates the warm, articulate, gentle tone of Gemini's "Callirrhoe" voice
 * using the best available browser SpeechSynthesis voices across
 * Chrome, Safari, Edge, Firefox, iOS, and Android when offline or in simulated mode.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

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
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  warmUpSpeechVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    warmUpSpeechVoices();
  };
}

// Preferred browser voices that closely match Callirrhoe's warm, conversational female tone
const PREFERRED_CALLIRRHOE_VOICE_NAMES = [
  // Edge / Windows Natural Neural voices (closest to Callirrhoe)
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Michelle Online (Natural) - English (United States)',
  'Microsoft Jenny - English (United States)',
  'Microsoft Aria - English (United States)',
  'Microsoft Zira - English (United States)',

  // Google / Android voices
  'Google US English',
  'Google UK English Female',
  'Google English (United States)',

  // Apple / Safari (iOS & macOS)
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

  // If local offline voice preferred (to prevent synthesis-failed on network/cloud voices)
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

  // 1. Try exact or partial match with preferred Callirrhoe-like voices
  for (const preferred of PREFERRED_CALLIRRHOE_VOICE_NAMES) {
    const match = voices.find(
      (v) =>
        v.name.toLowerCase() === preferred.toLowerCase() ||
        v.name.toLowerCase().includes(preferred.toLowerCase()),
    );
    if (match) return match;
  }

  // 2. Search for any English US female voice
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

  // 3. Any English US voice (prefer non-male)
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

  // 4. Any English voice
  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
}

export function speakAsCallirrhoe(
  text: string,
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

  const cleanText = (text || '').trim();
  if (!cleanText) {
    options?.onEnd?.();
    return true;
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

    // Callirrhoe prosody: articulate, natural speaking tempo and warm tone
    utterance.rate = options?.rate ?? 1.10;
    utterance.pitch = options?.pitch ?? 1.04;
    utterance.volume = 1.0;

    let hasEnded = false;
    let keepAliveTimer: any = null;

    utterance.onstart = () => {
      options?.onStart?.();
      // Chromium bugfix: prevent engine pause after 15s on longer sentences
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

        // Auto-recovery for Edge/Chrome "synthesis-failed" or network drop:
        // Automatically unfreeze and retry once with a guaranteed local offline voice
        if (
          !isRetry &&
          (e.error === 'synthesis-failed' || e.error === 'network' || e.error === 'audio-busy')
        ) {
          console.warn(
            `[MayaVoiceFallback] Synthesis error (${e.error}), recovering with local offline voice...`,
          );
          try {
            window.speechSynthesis.cancel();
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
          } catch {}
          setTimeout(() => {
            speakAsCallirrhoe(cleanText, options, true);
          }, 120);
          return;
        }

        // 'interrupted' and 'canceled' are standard browser lifecycle events when audio is stopped or replaced
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

    // Chromium audio endpoint release fix:
    // If currently speaking or pending, cancel and wait 120ms before triggering speak
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

export function stopMayaVoiceFallback(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}
  }
}
