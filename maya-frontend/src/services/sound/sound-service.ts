import { Platform } from 'react-native';

/**
 * Maya Gamified Sound Engine
 * Uses pre-loaded high fidelity audio assets (MP3) with Web Audio API synthesis as 100% offline fallback.
 */

// Audio Assets
const CALL_CONNECTED_ASSET = require('@/assets/sounds/call-connected.mp3');
const GOOD_JOB_ASSET = require('@/assets/sounds/good job.mp3');
const HINT_BUTTON_ASSET = require('@/assets/sounds/hint button press.mp3');
const OTHER_BUTTON_ASSET = require('@/assets/sounds/other button press.mp3');
const UNDERSTOOD_BUTTON_ASSET = require('@/assets/sounds/understood button press.mp3');
const MAYA_WELCOME_ASSET = require('@/assets/sounds/maya-welcome.wav');
const MAYA_NAME_PROMPT_ASSET = require('@/assets/sounds/maya-onboarding-name.wav');
const MAYA_PHONE_PROMPT_ASSET = require('@/assets/sounds/maya-onboarding-phone.wav');
const MAYA_GOAL_PROMPT_ASSET = require('@/assets/sounds/maya-goal-prompt.wav');
const MAYA_CHALLENGE_PROMPT_ASSET = require('@/assets/sounds/maya-challenge-prompt.wav');
const MAYA_LEVEL_PROMPT_ASSET = require('@/assets/sounds/maya-level-prompt.wav');
const MAYA_EMPLOYMENT_PROMPT_ASSET = require('@/assets/sounds/maya-employment-prompt.wav');
const MAYA_DAILY_GOAL_PROMPT_ASSET = require('@/assets/sounds/maya-daily-goal-prompt.wav');
const MAYA_SOCIAL_PROOF_PROMPT_ASSET = require('@/assets/sounds/maya-social-proof-prompt.wav');

const GOAL_AUDIO_ASSETS: Record<string, any> = {
  'better-job': require('@/assets/sounds/maya-goal-job.wav'),
  'work-abroad': require('@/assets/sounds/maya-goal-abroad.wav'),
  'speak-confidently': require('@/assets/sounds/maya-goal-confident.wav'),
  'travel': require('@/assets/sounds/maya-goal-travel.wav'),
  'exams': require('@/assets/sounds/maya-goal-exams.wav'),
};

const CHALLENGE_AUDIO_ASSETS: Record<string, any> = {
  'speaking-confidently': require('@/assets/sounds/maya-challenge-confidence.wav'),
  'getting-stuck': require('@/assets/sounds/maya-challenge-stuck.wav'),
  'listening': require('@/assets/sounds/maya-challenge-listening.wav'),
  'grammar': require('@/assets/sounds/maya-challenge-grammar.wav'),
  'vocabulary': require('@/assets/sounds/maya-challenge-vocab.wav'),
};

const LEVEL_AUDIO_ASSETS: Record<string, any> = {
  'beginner': require('@/assets/sounds/maya-level-beginner.wav'),
  'intermediate': require('@/assets/sounds/maya-level-intermediate.wav'),
  'upper-intermediate': require('@/assets/sounds/maya-level-upper-intermediate.wav'),
  'advanced': require('@/assets/sounds/maya-level-advanced.wav'),
};

const EMPLOYMENT_AUDIO_ASSETS: Record<string, any> = {
  'full-time': require('@/assets/sounds/maya-employment-full-time.wav'),
  'part-time': require('@/assets/sounds/maya-employment-part-time.wav'),
  'student': require('@/assets/sounds/maya-employment-student.wav'),
  'looking-for-job': require('@/assets/sounds/maya-employment-looking-for-job.wav'),
  'other': require('@/assets/sounds/maya-employment-other.wav'),
};

const DAILY_GOAL_AUDIO_ASSETS: Record<string, any> = {
  '5-min': require('@/assets/sounds/maya-daily-goal-5min.wav'),
  '10-min': require('@/assets/sounds/maya-daily-goal-10min.wav'),
  '15-min': require('@/assets/sounds/maya-daily-goal-15min.wav'),
  '30-min': require('@/assets/sounds/maya-daily-goal-30min.wav'),
};

let audioCtx: AudioContext | null = null;
let activeWhooshNodes: { noise: AudioBufferSourceNode; gain: GainNode } | null = null;

interface VoicePlayerHandle {
  stop: () => void;
}

interface VoiceCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

let welcomeVoiceHandle: VoicePlayerHandle | null = null;
let namePromptVoiceHandle: VoicePlayerHandle | null = null;
let phonePromptVoiceHandle: VoicePlayerHandle | null = null;
let goalPromptVoiceHandle: VoicePlayerHandle | null = null;
let goalFeedbackVoiceHandle: VoicePlayerHandle | null = null;
let challengePromptVoiceHandle: VoicePlayerHandle | null = null;
let challengeFeedbackVoiceHandle: VoicePlayerHandle | null = null;
let levelPromptVoiceHandle: VoicePlayerHandle | null = null;
let levelFeedbackVoiceHandle: VoicePlayerHandle | null = null;
let employmentPromptVoiceHandle: VoicePlayerHandle | null = null;
let employmentFeedbackVoiceHandle: VoicePlayerHandle | null = null;
let dailyGoalPromptVoiceHandle: VoicePlayerHandle | null = null;
let dailyGoalFeedbackVoiceHandle: VoicePlayerHandle | null = null;
let socialProofPromptVoiceHandle: VoicePlayerHandle | null = null;

// Decoded Web Audio Buffer Cache for 100% reliable iOS/Safari/Android/Windows playback
const audioBufferCache = new Map<string, AudioBuffer>();
const pendingBufferFetches = new Map<string, Promise<AudioBuffer | null>>();

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[sound-service] ❌ Web Audio API (AudioContext) is not supported in this browser');
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
      console.log(`[sound-service] 🔊 AudioContext created. Initial state: "${audioCtx.state}"`);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log(`[sound-service] ✅ AudioContext resumed successfully! State: "${audioCtx?.state}"`);
      }).catch((err) => {
        console.warn('[sound-service] ⚠️ AudioContext resume blocked by browser autoplay policy:', err);
      });
    }
    return audioCtx;
  } catch (err) {
    console.error('[sound-service] Error creating AudioContext:', err);
    return null;
  }
}

// Silent 1-sample WAV Data URI to prime iOS audio session into playback mode
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
let hasUnlockedAudio = false;

export function unlockAudioSession(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (!hasUnlockedAudio) {
    hasUnlockedAudio = true;
    try {
      const silentAudio = new Audio(SILENT_WAV);
      silentAudio.volume = 0.01;
      silentAudio.play().catch(() => {});
    } catch {}
  }
}

// Global user interaction listener to un-suspend AudioContext and prime iOS audio session
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudioSession, { passive: true });
  window.addEventListener('touchstart', unlockAudioSession, { passive: true });
  window.addEventListener('touchend', unlockAudioSession, { passive: true });
  window.addEventListener('keydown', unlockAudioSession, { passive: true });
  window.addEventListener('pointerdown', unlockAudioSession, { passive: true });
}

/**
 * Resolve an asset import into a playable URI string across Web and Native.
 */
function getAssetUri(asset: any): string | null {
  if (!asset) return null;
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'object') {
    if (typeof asset.default === 'string') return asset.default;
    if (asset.uri && typeof asset.uri === 'string') return asset.uri;
    if (asset.default?.uri && typeof asset.default.uri === 'string') return asset.default.uri;
  }
  try {
    const { Asset } = require('expo-asset');
    const resolved = Asset.fromModule(asset);
    if (resolved?.uri) return resolved.uri;
  } catch {}
  try {
    const { Image } = require('react-native');
    const resolved = Image.resolveAssetSource(asset);
    if (resolved?.uri) return resolved.uri;
  } catch {}
  return null;
}

const audioCache = new Map<string, HTMLAudioElement>();

function getPreloadedAudio(uri: string): HTMLAudioElement {
  let audio = audioCache.get(uri);
  if (!audio) {
    audio = new Audio(uri);
    audio.preload = 'auto';
    audioCache.set(uri, audio);
  }
  return audio;
}

/**
 * Pre-fetch and decode an audio asset directly into Web Audio memory (AudioBuffer).
 * Immune to iOS Safari HTTP 206 range request bugs, upsamples to native hardware rate (48kHz),
 * and has zero concurrent player limit.
 */
export async function loadAudioBuffer(uri: string): Promise<AudioBuffer | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!uri) return null;

  if (audioBufferCache.has(uri)) {
    return audioBufferCache.get(uri)!;
  }
  if (pendingBufferFetches.has(uri)) {
    return pendingBufferFetches.get(uri)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(uri);
      if (!res.ok) {
        throw new Error(`Failed to fetch audio: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const ctx = getAudioContext();
      if (!ctx) return null;

      const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        try {
          const ret = ctx.decodeAudioData(arrayBuffer, resolve, reject);
          if (ret && typeof (ret as any).then === 'function') {
            (ret as any).then(resolve).catch(reject);
          }
        } catch (e) {
          reject(e);
        }
      });

      audioBufferCache.set(uri, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      console.warn('[sound-service] loadAudioBuffer error for', uri, err);
      return null;
    } finally {
      pendingBufferFetches.delete(uri);
    }
  })();

  pendingBufferFetches.set(uri, fetchPromise);
  return fetchPromise;
}

/**
 * Universal voice player engine:
 * 1. Checks Web Audio buffer cache (instant playback, 0ms latency, zero iOS player limit).
 * 2. If not cached, fetches & decodes dynamically into Web Audio.
 * 3. Graceful fallback to HTMLAudioElement if Web Audio fails.
 */
function playUniversalVoiceAsset(
  asset: any,
  callbacks?: VoiceCallbacks,
  onSetHandle?: (handle: VoicePlayerHandle | null) => void,
): void {
  unlockAudioSession();

  const uri = getAssetUri(asset);
  if (!uri) {
    callbacks?.onEnd?.();
    return;
  }

  let isStopped = false;
  let activeBufferSource: AudioBufferSourceNode | null = null;
  let activeAudioElement: HTMLAudioElement | null = null;

  const handle: VoicePlayerHandle = {
    stop: () => {
      isStopped = true;
      if (activeBufferSource) {
        try {
          activeBufferSource.onended = null;
          activeBufferSource.stop(0);
          activeBufferSource.disconnect();
        } catch {}
        activeBufferSource = null;
      }
      if (activeAudioElement) {
        try {
          activeAudioElement.onended = null;
          activeAudioElement.onerror = null;
          activeAudioElement.pause();
          activeAudioElement.currentTime = 0;
        } catch {}
        activeAudioElement = null;
      }
      onSetHandle?.(null);
    },
  };

  onSetHandle?.(handle);

  const ctx = getAudioContext();
  const cachedBuffer = audioBufferCache.get(uri);

  // Strategy 1: Instant Web Audio buffer playback (0ms, 100% reliable on iOS/Android/Desktop)
  if (ctx && cachedBuffer) {
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createBufferSource();
      source.buffer = cachedBuffer;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      source.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => {
        if (!isStopped) {
          onSetHandle?.(null);
          callbacks?.onEnd?.();
        }
      };

      activeBufferSource = source;
      source.start(0);
      callbacks?.onStart?.();
      return;
    } catch (e) {
      console.warn('[sound-service] Instant Web Audio playback failed:', e);
    }
  }

  // Strategy 2: Fetch and decode buffer, with fallback to HTMLAudioElement
  loadAudioBuffer(uri)
    .then((buffer) => {
      if (isStopped) return;
      if (buffer && ctx) {
        try {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const gain = ctx.createGain();
          gain.gain.value = 1.0;
          source.connect(gain);
          gain.connect(ctx.destination);

          source.onended = () => {
            if (!isStopped) {
              onSetHandle?.(null);
              callbacks?.onEnd?.();
            }
          };

          activeBufferSource = source;
          source.start(0);
          callbacks?.onStart?.();
          return;
        } catch (e) {
          console.warn('[sound-service] Async Web Audio playback failed:', e);
        }
      }

      // Strategy 3: HTMLAudioElement fallback
      if (!isStopped) {
        playWithAudioElement();
      }
    })
    .catch(() => {
      if (!isStopped) {
        playWithAudioElement();
      }
    });

  function playWithAudioElement() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
      return;
    }
    try {
      const audio = new Audio(uri || undefined);
      activeAudioElement = audio;
      audio.volume = 1.0;

      audio.onplay = () => {
        if (!isStopped) callbacks?.onStart?.();
      };

      audio.onended = () => {
        if (!isStopped) {
          onSetHandle?.(null);
          callbacks?.onEnd?.();
        }
      };

      audio.onerror = (e) => {
        if (!isStopped) {
          onSetHandle?.(null);
          callbacks?.onError?.(e);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (!isStopped) {
            onSetHandle?.(null);
            callbacks?.onError?.(err);
          }
        });
      }
    } catch (err) {
      if (!isStopped) {
        onSetHandle?.(null);
        callbacks?.onError?.(err);
      }
    }
  }
}

// Preload audio assets in web browser
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      preloadAllOnboardingVoicesInOrder();
      [
        CALL_CONNECTED_ASSET,
        GOOD_JOB_ASSET,
        HINT_BUTTON_ASSET,
        OTHER_BUTTON_ASSET,
        UNDERSTOOD_BUTTON_ASSET,
      ].forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) getPreloadedAudio(uri);
      });
    } catch {}
  }, 200);
}

type MicSuppressor = (durationMs: number) => void;
let activeMicSuppressor: MicSuppressor | null = null;

/**
 * Register a mic suppressor callback (e.g., from useLiveCall) to temporarily
 * mute mic capture and VAD whenever UI sounds play during a call.
 */
export function registerMicSuppressor(suppressor: MicSuppressor | null): () => void {
  activeMicSuppressor = suppressor;
  return () => {
    if (activeMicSuppressor === suppressor) {
      activeMicSuppressor = null;
    }
  };
}

export function suppressMicDuringSound(durationMs: number): void {
  if (activeMicSuppressor) {
    try {
      activeMicSuppressor(durationMs);
    } catch (e) {
      console.warn('[sound-service] Error calling activeMicSuppressor:', e);
    }
  }
}

/**
 * Universal sound player using HTMLAudioElement with instant overlapping cloning
 * and automatic fallback to Web Audio synthesis.
 */
export function playSoundAsset(
  asset: any,
  volume: number = 0.75,
  fallbackFn?: () => void,
  onEnded?: () => void,
  maxDurationMs?: number,
): void {
  const estimatedDuration = maxDurationMs || 1000;
  suppressMicDuringSound(estimatedDuration + 250);

  let hasTriggeredEnded = false;
  const notifyEnded = () => {
    if (!hasTriggeredEnded) {
      hasTriggeredEnded = true;
      if (onEnded) onEnded();
    }
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        const player = (audio.cloneNode(true) as HTMLAudioElement) || audio;
        player.volume = Math.max(0, Math.min(1, volume));

        player.onended = notifyEnded;
        const endTimeoutMs = maxDurationMs ? maxDurationMs : 2200;
        setTimeout(notifyEnded, endTimeoutMs);

        if (maxDurationMs) {
          setTimeout(() => {
            try {
              player.pause();
              player.currentTime = 0;
            } catch {}
          }, maxDurationMs);
        }

        player.play().catch(() => {
          try {
            audio.currentTime = 0;
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.onended = notifyEnded;
            if (maxDurationMs) {
              setTimeout(() => {
                try {
                  audio.pause();
                  audio.currentTime = 0;
                } catch {}
              }, maxDurationMs);
            }
            audio.play().catch(() => {
              if (fallbackFn) fallbackFn();
              notifyEnded();
            });
          } catch {
            if (fallbackFn) fallbackFn();
            notifyEnded();
          }
        });
        return;
      }
    } catch (err) {
      console.warn('[sound-service] playSoundAsset error:', err);
    }
  }

  if (fallbackFn) {
    fallbackFn();
  }
  if (onEnded) {
    setTimeout(notifyEnded, 1500);
  }
}

/**
 * Call Connected Sound (call-connected.mp3)
 * Plays when connection establishes with Maya.
 * Supports onEnded callback so screen transition and greeting audio
 * begin cleanly right after the chime completes.
 */
export function playCallConnectedSound(onEnded?: () => void): void {
  console.log('[sound-service] 📞 playCallConnectedSound() called');
  playSoundAsset(
    CALL_CONNECTED_ASSET,
    0.85,
    () => {
      playAnalysisCompleteSound();
    },
    onEnded,
  );
}

/**
 * Good Job Sound (good job.mp3)
 * Plays on the session completion screen.
 */
export function playGoodJobSound(): void {
  console.log('[sound-service] 🌟 playGoodJobSound() called');
  playSoundAsset(GOOD_JOB_ASSET, 0.85, () => {
    playFinishReviewFanfare();
  });
}

/**
 * Hint Button Press Sound (hint button press.mp3)
 * Plays when the user taps the Hint lightbulb button during a call.
 * Uses gentle 0.40 volume and caps playback to 900ms to prevent acoustic leakage into mic.
 */
export function playHintButtonSound(): void {
  console.log('[sound-service] 💡 playHintButtonSound() called');
  playSoundAsset(
    HINT_BUTTON_ASSET,
    0.4,
    () => {
      playStepPop(2);
    },
    undefined,
    900,
  );
}

/**
 * Other Button Press Sound (other button press.mp3)
 * Plays for interactive toggles, controls, and secondary buttons.
 */
export function playOtherButtonSound(): void {
  console.log('[sound-service] 🔘 playOtherButtonSound() called');
  playSoundAsset(
    OTHER_BUTTON_ASSET,
    0.45,
    () => {
      playStepPop(0);
    },
    undefined,
    600,
  );
}

/**
 * Understood Button Press Sound (understood button press.mp3)
 * Plays when tapping "Understood" cards, feedback ratings, and session-review actions.
 */
export function playUnderstoodTapSound(): void {
  console.log('[sound-service] 👍 playUnderstoodTapSound() called');
  playSoundAsset(
    UNDERSTOOD_BUTTON_ASSET,
    0.5,
    () => {
      playSynthesizedUnderstoodTap();
    },
    undefined,
    800,
  );
}

export const playUnderstoodButtonSound = playUnderstoodTapSound;

/**
 * 1. Gentle Soft Whoosh / Wind Shimmer Sweep
 */
export function playScanningSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  stopScanningSound();

  try {
    const duration = 3.4;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Warm, organic filtered noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.35;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Resonant bandpass filter: sweeps smoothly 260Hz -> 850Hz -> 320Hz
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;

    const now = ctx.currentTime;
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + 1.7);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);

    // Audible gain envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.48, now + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Subtle ethereal glass shimmer harmonic
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(880, now);
    shimmerOsc.frequency.exponentialRampToValueAtTime(1174, now + 1.7);
    shimmerOsc.frequency.exponentialRampToValueAtTime(880, now + duration);

    shimmerGain.gain.setValueAtTime(0.001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.08, now + 0.8);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    noise.start(now);
    shimmerOsc.start(now);
    noise.stop(now + duration);
    shimmerOsc.stop(now + duration);

    activeWhooshNodes = { noise, gain };
  } catch (err) {
    console.error('[sound-service] Whoosh play error:', err);
  }
}

/**
 * Stop active scanning sound
 */
export function stopScanningSound(): void {
  if (activeWhooshNodes && audioCtx) {
    try {
      activeWhooshNodes.gain.gain.setValueAtTime(
        activeWhooshNodes.gain.gain.value,
        audioCtx.currentTime,
      );
      activeWhooshNodes.gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      setTimeout(() => {
        try {
          activeWhooshNodes?.noise.stop();
        } catch {}
        activeWhooshNodes = null;
      }, 100);
    } catch {}
  }
}

/**
 * 2. Juicy Gamified Checkmark Pop
 */
export function playStepPop(stepIndex: number = 0): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    const targetFreq = freqs[stepIndex % freqs.length] || 523.25;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(targetFreq * 1.3, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(targetFreq * 0.85, now + 0.18);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (err) {
    console.error('[sound-service] Step pop error:', err);
  }
}

/**
 * 2b. Crisp, Ultra-Low-Latency Spin Wheel Ratchet Tick Sound
 */
let lastWheelTickTime = 0;
export function playWheelTickSound(progress: number = 0): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Prevent overlapping audio nodes during high-velocity initial spin
    if (now - lastWheelTickTime < 0.045) return;
    lastWheelTickTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Subtle rising pitch as the wheel decelerates toward the winning slice
    const baseFreq = 680 + Math.min(1, Math.max(0, progress)) * 340;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 0.032);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.034);
  } catch {}
}

/**
 * 2c. Playful "Almost / Try Again" 2-note chime when wheel lands on Try Again
 */
export function playTryAgainSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [587.33, 493.88]; // D5 -> B4 playful bounce
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.32, startTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.24);
    });
  } catch {}
}

/**
 * 3. Celebratory Analysis Complete Chime
 */
export function playAnalysisCompleteSound(): void {
  stopScanningSound();

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const noteDelay = idx * 0.06;
      const startTime = now + noteDelay;
      const noteDuration = 0.85;

      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 2, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.38, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      harmonic.start(startTime);
      osc.stop(startTime + noteDuration);
      harmonic.stop(startTime + noteDuration);
    });
  } catch (err) {
    console.error('[sound-service] Complete sound error:', err);
  }
}

/**
 * 4. Synthesized fallback for Understood tap
 */
function playSynthesizedUnderstoodTap(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickOsc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);

    clickOsc.start(now);
    clickOsc.stop(now + 0.025);

    const tones = [587.33, 880.00];
    tones.forEach((freq, idx) => {
      const startTime = now + idx * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.16);
    });
  } catch (err) {
    console.warn('[sound-service] Understood tap sound error:', err);
  }
}

/**
 * 5. Celebratory "Finish Review" Victory Fanfare
 */
export function playFinishReviewFanfare(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.055;
      const duration = 0.55;

      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 1.5, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.45, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      harmonic.start(startTime);
      osc.stop(startTime + duration);
      harmonic.stop(startTime + duration);
    });
  } catch (err) {
    console.warn('[sound-service] Finish review fanfare error:', err);
  }
}

/**
 * 6. Maya's High-Fidelity Welcome Voice Introduction
 * Plays Kokoro-82M cheerful neural voice (Heart + Sky blend)
 */
export function playMayaWelcomeVoice(callbacks?: VoiceCallbacks): void {
  stopMayaWelcomeVoice();
  playUniversalVoiceAsset(MAYA_WELCOME_ASSET, callbacks, (h) => {
    welcomeVoiceHandle = h;
  });
}

export function stopMayaWelcomeVoice(): void {
  welcomeVoiceHandle?.stop();
  welcomeVoiceHandle = null;
}

/**
 * 7. Maya's Onboarding Name Prompt Voice
 * Plays Kokoro-82M cheerful neural voice (Heart + Sky blend)
 * "Hi! I'm Maya, your personal English speaking coach. What should I call you?"
 */
export function playMayaNamePromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaNamePromptVoice();
  playUniversalVoiceAsset(MAYA_NAME_PROMPT_ASSET, callbacks, (h) => {
    namePromptVoiceHandle = h;
  });
}

export function stopMayaNamePromptVoice(): void {
  namePromptVoiceHandle?.stop();
  namePromptVoiceHandle = null;
}

/**
 * 8. Maya's Onboarding Phone Prompt Voice
 * Plays Kokoro-82M cheerful neural voice (Heart + Sky blend)
 * "To continue, enter your phone number and enable your Starter Plan. Enter your mobile number to get started!"
 */
export function playMayaPhonePromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaPhonePromptVoice();
  playUniversalVoiceAsset(MAYA_PHONE_PROMPT_ASSET, callbacks, (h) => {
    phonePromptVoiceHandle = h;
  });
}

export function stopMayaPhonePromptVoice(): void {
  phonePromptVoiceHandle?.stop();
  phonePromptVoiceHandle = null;
}

/**
 * Sequentially preloads all onboarding voice assets in the exact chronological order
 * of the user journey (Welcome -> Name -> Phone -> Goal -> Challenge), ensuring
 * each upcoming screen's audio is fully loaded into memory before the user arrives.
 */
let hasInitiatedSequentialPreload = false;
export function preloadAllOnboardingVoicesInOrder(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (hasInitiatedSequentialPreload) return;
  hasInitiatedSequentialPreload = true;

  const orderedAssets = [
    // Screen 1: Welcome Screen
    MAYA_WELCOME_ASSET,
    // Screen 2: Name Prompt Screen
    MAYA_NAME_PROMPT_ASSET,
    // Screen 3: Phone Prompt Screen
    MAYA_PHONE_PROMPT_ASSET,
    // Screen 4: Goal Question Prompt
    MAYA_GOAL_PROMPT_ASSET,
    // Screen 4: Goal Selection Feedback Voices
    GOAL_AUDIO_ASSETS['better-job'],
    GOAL_AUDIO_ASSETS['speak-confidently'],
    GOAL_AUDIO_ASSETS['work-abroad'],
    GOAL_AUDIO_ASSETS['travel'],
    GOAL_AUDIO_ASSETS['exams'],
    // Screen 5: Challenge Question Prompt
    MAYA_CHALLENGE_PROMPT_ASSET,
    // Screen 5: Challenge Selection Feedback Voices
    CHALLENGE_AUDIO_ASSETS['speaking-confidently'],
    CHALLENGE_AUDIO_ASSETS['getting-stuck'],
    CHALLENGE_AUDIO_ASSETS['listening'],
    CHALLENGE_AUDIO_ASSETS['grammar'],
    CHALLENGE_AUDIO_ASSETS['vocabulary'],
    // Screen 6: Level Question Prompt & Selections
    MAYA_LEVEL_PROMPT_ASSET,
    LEVEL_AUDIO_ASSETS['beginner'],
    LEVEL_AUDIO_ASSETS['intermediate'],
    LEVEL_AUDIO_ASSETS['upper-intermediate'],
    LEVEL_AUDIO_ASSETS['advanced'],
    // Screen 7: Employment Question Prompt & Selections
    MAYA_EMPLOYMENT_PROMPT_ASSET,
    EMPLOYMENT_AUDIO_ASSETS['full-time'],
    EMPLOYMENT_AUDIO_ASSETS['part-time'],
    EMPLOYMENT_AUDIO_ASSETS['student'],
    EMPLOYMENT_AUDIO_ASSETS['looking-for-job'],
    EMPLOYMENT_AUDIO_ASSETS['other'],
    // Screen 8: Daily Goal Question Prompt & Selections
    MAYA_DAILY_GOAL_PROMPT_ASSET,
    DAILY_GOAL_AUDIO_ASSETS['5-min'],
    DAILY_GOAL_AUDIO_ASSETS['10-min'],
    DAILY_GOAL_AUDIO_ASSETS['15-min'],
    DAILY_GOAL_AUDIO_ASSETS['30-min'],
  ];

  let delay = 100;
  orderedAssets.forEach((asset) => {
    setTimeout(() => {
      try {
        const uri = getAssetUri(asset);
        if (uri) {
          loadAudioBuffer(uri);
        }
      } catch (e) {
        console.warn('[sound-service] sequential preload error for asset:', e);
      }
    }, delay);
    delay += 180; // Smooth sequential stream without freezing browser thread
  });
}

/**
 * 8d. Maya's Level Question Prompt Voice
 * "What's your current level? Be honest -- I'll meet you right where you are!"
 */
export function playMayaLevelPromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaLevelPromptVoice();
  playUniversalVoiceAsset(MAYA_LEVEL_PROMPT_ASSET, callbacks, (h) => {
    levelPromptVoiceHandle = h;
  });
}

export function stopMayaLevelPromptVoice(): void {
  levelPromptVoiceHandle?.stop();
  levelPromptVoiceHandle = null;
}

/**
 * 8e. Maya's Employment Question Prompt Voice
 * "What is your current employment status? This helps us personalise your practice sessions!"
 */
export function playMayaEmploymentPromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaEmploymentPromptVoice();
  playUniversalVoiceAsset(MAYA_EMPLOYMENT_PROMPT_ASSET, callbacks, (h) => {
    employmentPromptVoiceHandle = h;
  });
}

export function stopMayaEmploymentPromptVoice(): void {
  employmentPromptVoiceHandle?.stop();
  employmentPromptVoiceHandle = null;
}

/**
 * 8f. Maya's Daily Goal Question Prompt Voice
 * "How much can you practice daily? Even five or ten minutes a day makes a HUGE difference!"
 */
export function playMayaDailyGoalPromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaDailyGoalPromptVoice();
  playUniversalVoiceAsset(MAYA_DAILY_GOAL_PROMPT_ASSET, callbacks, (h) => {
    dailyGoalPromptVoiceHandle = h;
  });
}

export function stopMayaDailyGoalPromptVoice(): void {
  dailyGoalPromptVoiceHandle?.stop();
  dailyGoalPromptVoiceHandle = null;
}

/**
 * Preload all Maya Level Voice audio assets into memory
 */
export function preloadLevelVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_LEVEL_PROMPT_ASSET);
      if (promptUri) loadAudioBuffer(promptUri);
      Object.values(LEVEL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) loadAudioBuffer(uri);
      });
    } catch (e) {
      console.warn('[sound-service] preloadLevelVoices error:', e);
    }
  }
}

/**
 * Maya's Level Selection Feedback Voice
 */
export function playMayaLevelFeedbackVoice(
  levelId: string,
  callbacks?: VoiceCallbacks,
): void {
  stopMayaLevelPromptVoice();
  stopMayaLevelFeedbackVoice();

  const asset = LEVEL_AUDIO_ASSETS[levelId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  playUniversalVoiceAsset(asset, callbacks, (h) => {
    levelFeedbackVoiceHandle = h;
  });
}

export function stopMayaLevelFeedbackVoice(): void {
  levelFeedbackVoiceHandle?.stop();
  levelFeedbackVoiceHandle = null;
}

/**
 * Preload all Maya Employment Voice audio assets into memory
 */
export function preloadEmploymentVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_EMPLOYMENT_PROMPT_ASSET);
      if (promptUri) loadAudioBuffer(promptUri);
      Object.values(EMPLOYMENT_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) loadAudioBuffer(uri);
      });
    } catch (e) {
      console.warn('[sound-service] preloadEmploymentVoices error:', e);
    }
  }
}

/**
 * Maya's Employment Selection Feedback Voice
 */
export function playMayaEmploymentFeedbackVoice(
  employmentId: string,
  callbacks?: VoiceCallbacks,
): void {
  stopMayaEmploymentPromptVoice();
  stopMayaEmploymentFeedbackVoice();

  const asset = EMPLOYMENT_AUDIO_ASSETS[employmentId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  playUniversalVoiceAsset(asset, callbacks, (h) => {
    employmentFeedbackVoiceHandle = h;
  });
}

export function stopMayaEmploymentFeedbackVoice(): void {
  employmentFeedbackVoiceHandle?.stop();
  employmentFeedbackVoiceHandle = null;
}

/**
 * Preload all Maya Daily Goal Voice audio assets into memory
 */
export function preloadDailyGoalVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_DAILY_GOAL_PROMPT_ASSET);
      if (promptUri) loadAudioBuffer(promptUri);
      Object.values(DAILY_GOAL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) loadAudioBuffer(uri);
      });
    } catch (e) {
      console.warn('[sound-service] preloadDailyGoalVoices error:', e);
    }
  }
}

/**
 * Maya's Daily Goal Selection Feedback Voice
 */
export function playMayaDailyGoalFeedbackVoice(
  dailyGoalId: string,
  callbacks?: VoiceCallbacks,
): void {
  stopMayaDailyGoalPromptVoice();
  stopMayaDailyGoalFeedbackVoice();

  const asset = DAILY_GOAL_AUDIO_ASSETS[dailyGoalId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  playUniversalVoiceAsset(asset, callbacks, (h) => {
    dailyGoalFeedbackVoiceHandle = h;
  });
}

export function stopMayaDailyGoalFeedbackVoice(): void {
  dailyGoalFeedbackVoiceHandle?.stop();
  dailyGoalFeedbackVoiceHandle = null;
}

/**
 * Preload all Maya Goal Voice audio assets into memory
 */
export function preloadGoalVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_GOAL_PROMPT_ASSET);
      if (promptUri) loadAudioBuffer(promptUri);
      Object.values(GOAL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) loadAudioBuffer(uri);
      });
    } catch (e) {
      console.warn('[sound-service] preloadGoalVoices error:', e);
    }
  }
}

/**
 * 8b. Maya's Goal Question Prompt Voice
 * "What's your biggest goal? Pick what matters most to you right now!"
 */
export function playMayaGoalPromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaGoalPromptVoice();
  playUniversalVoiceAsset(MAYA_GOAL_PROMPT_ASSET, callbacks, (h) => {
    goalPromptVoiceHandle = h;
  });
}

export function stopMayaGoalPromptVoice(): void {
  goalPromptVoiceHandle?.stop();
  goalPromptVoiceHandle = null;
}

/**
 * Preload all Maya Challenge Voice audio assets into memory
 */
export function preloadChallengeVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_CHALLENGE_PROMPT_ASSET);
      if (promptUri) loadAudioBuffer(promptUri);
      Object.values(CHALLENGE_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) loadAudioBuffer(uri);
      });
    } catch (e) {
      console.warn('[sound-service] preloadChallengeVoices error:', e);
    }
  }
}

/**
 * 8c. Maya's Challenge Question Prompt Voice
 * "What's hardest for you right now? Pick your biggest challenge when speaking English."
 */
export function playMayaChallengePromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaChallengePromptVoice();
  playUniversalVoiceAsset(MAYA_CHALLENGE_PROMPT_ASSET, callbacks, (h) => {
    challengePromptVoiceHandle = h;
  });
}

export function stopMayaChallengePromptVoice(): void {
  challengePromptVoiceHandle?.stop();
  challengePromptVoiceHandle = null;
}

/**
 * 9. Maya's Personalized Goal Selection Feedback Voices
 * Plays tailored encouragement when user selects their goal.
 */
export function playMayaGoalFeedbackVoice(
  goalId: string,
  callbacks?: VoiceCallbacks,
): void {
  stopMayaGoalPromptVoice();
  stopMayaGoalFeedbackVoice();

  const asset = GOAL_AUDIO_ASSETS[goalId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  playUniversalVoiceAsset(asset, callbacks, (h) => {
    goalFeedbackVoiceHandle = h;
  });
}

export function stopMayaGoalFeedbackVoice(): void {
  goalFeedbackVoiceHandle?.stop();
  goalFeedbackVoiceHandle = null;
}

/**
 * 10. Maya's Personalized Challenge Selection Feedback Voices
 * Plays tailored encouragement when user selects their biggest challenge.
 */
export function playMayaChallengeFeedbackVoice(
  challengeId: string,
  callbacks?: VoiceCallbacks,
): void {
  stopMayaChallengePromptVoice();
  stopMayaChallengeFeedbackVoice();

  const asset = CHALLENGE_AUDIO_ASSETS[challengeId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  playUniversalVoiceAsset(asset, callbacks, (h) => {
    challengeFeedbackVoiceHandle = h;
  });
}

export function stopMayaChallengeFeedbackVoice(): void {
  challengeFeedbackVoiceHandle?.stop();
  challengeFeedbackVoiceHandle = null;
}

/**
 * 11. Maya's Social Proof Screen Voice Prompt
 * Plays Gemini TTS Callirrhoe voice:
 * "See your progress in just two weeks! The more you practice, the more confident you'll become! Over ten thousand people already use Maya to speak English!"
 */
export function playMayaSocialProofPromptVoice(callbacks?: VoiceCallbacks): void {
  stopMayaSocialProofPromptVoice();
  playUniversalVoiceAsset(MAYA_SOCIAL_PROOF_PROMPT_ASSET, callbacks, (h) => {
    socialProofPromptVoiceHandle = h;
  });
}

export function stopMayaSocialProofPromptVoice(): void {
  socialProofPromptVoiceHandle?.stop();
  socialProofPromptVoiceHandle = null;
}

