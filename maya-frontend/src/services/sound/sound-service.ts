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
let welcomeAudioPlayer: HTMLAudioElement | null = null;
let namePromptAudioPlayer: HTMLAudioElement | null = null;
let phonePromptAudioPlayer: HTMLAudioElement | null = null;
let goalPromptAudioPlayer: HTMLAudioElement | null = null;
let challengePromptAudioPlayer: HTMLAudioElement | null = null;
let levelPromptAudioPlayer: HTMLAudioElement | null = null;
let employmentPromptAudioPlayer: HTMLAudioElement | null = null;
let dailyGoalPromptAudioPlayer: HTMLAudioElement | null = null;
let goalAudioPlayer: HTMLAudioElement | null = null;
let challengeAudioPlayer: HTMLAudioElement | null = null;
let levelAudioPlayer: HTMLAudioElement | null = null;
let employmentAudioPlayer: HTMLAudioElement | null = null;
let dailyGoalAudioPlayer: HTMLAudioElement | null = null;

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

// Global user interaction listener to un-suspend AudioContext
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log(`[sound-service] 🔓 Unlocked AudioContext via user interaction. State: "${ctx.state}"`);
      }).catch(() => {});
    }
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('pointerdown', unlock, { passive: true });
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
export function playMayaWelcomeVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaWelcomeVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_WELCOME_ASSET);
      if (uri) {
        const audio = new Audio(uri);
        welcomeAudioPlayer = audio;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (welcomeAudioPlayer === audio) {
            welcomeAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (welcomeAudioPlayer === audio) {
            welcomeAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (welcomeAudioPlayer === audio) {
              welcomeAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  // Fallback for native or unsupported environments
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaWelcomeVoice(): void {
  if (welcomeAudioPlayer) {
    try {
      welcomeAudioPlayer.pause();
      welcomeAudioPlayer.currentTime = 0;
    } catch {}
    welcomeAudioPlayer = null;
  }
}

/**
 * 7. Maya's Onboarding Name Prompt Voice
 * Plays Kokoro-82M cheerful neural voice (Heart + Sky blend)
 * "Hi! I'm Maya, your personal English speaking coach. What should I call you?"
 */
export function playMayaNamePromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaNamePromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_NAME_PROMPT_ASSET);
      if (uri) {
        const audio = new Audio(uri);
        namePromptAudioPlayer = audio;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (namePromptAudioPlayer === audio) {
            namePromptAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (namePromptAudioPlayer === audio) {
            namePromptAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (namePromptAudioPlayer === audio) {
              namePromptAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaNamePromptVoice(): void {
  if (namePromptAudioPlayer) {
    try {
      namePromptAudioPlayer.pause();
      namePromptAudioPlayer.currentTime = 0;
    } catch {}
    namePromptAudioPlayer = null;
  }
}

/**
 * 8. Maya's Onboarding Phone Prompt Voice
 * Plays Kokoro-82M cheerful neural voice (Heart + Sky blend)
 * "To continue, enter your phone number and enable your Starter Plan. Enter your mobile number to get started!"
 */
export function playMayaPhonePromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaPhonePromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_PHONE_PROMPT_ASSET);
      if (uri) {
        const audio = new Audio(uri);
        phonePromptAudioPlayer = audio;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (phonePromptAudioPlayer === audio) {
            phonePromptAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (phonePromptAudioPlayer === audio) {
            phonePromptAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (phonePromptAudioPlayer === audio) {
              phonePromptAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaPhonePromptVoice(): void {
  if (phonePromptAudioPlayer) {
    try {
      phonePromptAudioPlayer.pause();
      phonePromptAudioPlayer.currentTime = 0;
    } catch {}
    phonePromptAudioPlayer = null;
  }
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
          const audio = getPreloadedAudio(uri);
          audio.load();
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
export function playMayaLevelPromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaLevelPromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_LEVEL_PROMPT_ASSET);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        levelPromptAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (levelPromptAudioPlayer === audio) levelPromptAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (levelPromptAudioPlayer === audio) levelPromptAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (levelPromptAudioPlayer === audio) levelPromptAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaLevelPromptVoice(): void {
  if (levelPromptAudioPlayer) {
    try {
      levelPromptAudioPlayer.onended = null;
      levelPromptAudioPlayer.onerror = null;
      levelPromptAudioPlayer.pause();
      levelPromptAudioPlayer.currentTime = 0;
    } catch {}
    levelPromptAudioPlayer = null;
  }
}

/**
 * 8e. Maya's Employment Question Prompt Voice
 * "What is your current employment status? This helps us personalise your practice sessions!"
 */
export function playMayaEmploymentPromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaEmploymentPromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_EMPLOYMENT_PROMPT_ASSET);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        employmentPromptAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (employmentPromptAudioPlayer === audio) employmentPromptAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (employmentPromptAudioPlayer === audio) employmentPromptAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (employmentPromptAudioPlayer === audio) employmentPromptAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaEmploymentPromptVoice(): void {
  if (employmentPromptAudioPlayer) {
    try {
      employmentPromptAudioPlayer.onended = null;
      employmentPromptAudioPlayer.onerror = null;
      employmentPromptAudioPlayer.pause();
      employmentPromptAudioPlayer.currentTime = 0;
    } catch {}
    employmentPromptAudioPlayer = null;
  }
}

/**
 * 8f. Maya's Daily Goal Question Prompt Voice
 * "How much can you practice daily? Even five or ten minutes a day makes a HUGE difference!"
 */
export function playMayaDailyGoalPromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaDailyGoalPromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_DAILY_GOAL_PROMPT_ASSET);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        dailyGoalPromptAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (dailyGoalPromptAudioPlayer === audio) dailyGoalPromptAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (dailyGoalPromptAudioPlayer === audio) dailyGoalPromptAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (dailyGoalPromptAudioPlayer === audio) dailyGoalPromptAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaDailyGoalPromptVoice(): void {
  if (dailyGoalPromptAudioPlayer) {
    try {
      dailyGoalPromptAudioPlayer.onended = null;
      dailyGoalPromptAudioPlayer.onerror = null;
      dailyGoalPromptAudioPlayer.pause();
      dailyGoalPromptAudioPlayer.currentTime = 0;
    } catch {}
    dailyGoalPromptAudioPlayer = null;
  }
}

/**
 * Preload all Maya Level Voice audio assets into memory
 */
export function preloadLevelVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_LEVEL_PROMPT_ASSET);
      if (promptUri) getPreloadedAudio(promptUri).load();
      Object.values(LEVEL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) getPreloadedAudio(uri).load();
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
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): void {
  stopMayaLevelPromptVoice();
  stopMayaLevelFeedbackVoice();

  const asset = LEVEL_AUDIO_ASSETS[levelId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        levelAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (levelAudioPlayer === audio) levelAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (levelAudioPlayer === audio) levelAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (levelAudioPlayer === audio) levelAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaLevelFeedbackVoice(): void {
  if (levelAudioPlayer) {
    try {
      levelAudioPlayer.onended = null;
      levelAudioPlayer.onerror = null;
      levelAudioPlayer.pause();
      levelAudioPlayer.currentTime = 0;
    } catch {}
    levelAudioPlayer = null;
  }
}

/**
 * Preload all Maya Employment Voice audio assets into memory
 */
export function preloadEmploymentVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_EMPLOYMENT_PROMPT_ASSET);
      if (promptUri) getPreloadedAudio(promptUri).load();
      Object.values(EMPLOYMENT_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) getPreloadedAudio(uri).load();
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
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): void {
  stopMayaEmploymentPromptVoice();
  stopMayaEmploymentFeedbackVoice();

  const asset = EMPLOYMENT_AUDIO_ASSETS[employmentId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        employmentAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (employmentAudioPlayer === audio) employmentAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (employmentAudioPlayer === audio) employmentAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (employmentAudioPlayer === audio) employmentAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaEmploymentFeedbackVoice(): void {
  if (employmentAudioPlayer) {
    try {
      employmentAudioPlayer.onended = null;
      employmentAudioPlayer.onerror = null;
      employmentAudioPlayer.pause();
      employmentAudioPlayer.currentTime = 0;
    } catch {}
    employmentAudioPlayer = null;
  }
}

/**
 * Preload all Maya Daily Goal Voice audio assets into memory
 */
export function preloadDailyGoalVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_DAILY_GOAL_PROMPT_ASSET);
      if (promptUri) getPreloadedAudio(promptUri).load();
      Object.values(DAILY_GOAL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) getPreloadedAudio(uri).load();
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
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): void {
  stopMayaDailyGoalPromptVoice();
  stopMayaDailyGoalFeedbackVoice();

  const asset = DAILY_GOAL_AUDIO_ASSETS[dailyGoalId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        dailyGoalAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => callbacks?.onStart?.();
        audio.onended = () => {
          if (dailyGoalAudioPlayer === audio) dailyGoalAudioPlayer = null;
          callbacks?.onEnd?.();
        };
        audio.onerror = (e) => {
          if (dailyGoalAudioPlayer === audio) dailyGoalAudioPlayer = null;
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (dailyGoalAudioPlayer === audio) dailyGoalAudioPlayer = null;
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }
  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaDailyGoalFeedbackVoice(): void {
  if (dailyGoalAudioPlayer) {
    try {
      dailyGoalAudioPlayer.onended = null;
      dailyGoalAudioPlayer.onerror = null;
      dailyGoalAudioPlayer.pause();
      dailyGoalAudioPlayer.currentTime = 0;
    } catch {}
    dailyGoalAudioPlayer = null;
  }
}

/**
 * Preload all Maya Goal Voice audio assets into memory
 */
export function preloadGoalVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_GOAL_PROMPT_ASSET);
      if (promptUri) {
        getPreloadedAudio(promptUri).load();
      }
      Object.values(GOAL_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) {
          const audio = getPreloadedAudio(uri);
          audio.load();
        }
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
export function playMayaGoalPromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaGoalPromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_GOAL_PROMPT_ASSET);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        goalPromptAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (goalPromptAudioPlayer === audio) {
            goalPromptAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (goalPromptAudioPlayer === audio) {
            goalPromptAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (goalPromptAudioPlayer === audio) {
              goalPromptAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaGoalPromptVoice(): void {
  if (goalPromptAudioPlayer) {
    try {
      goalPromptAudioPlayer.onended = null;
      goalPromptAudioPlayer.onerror = null;
      goalPromptAudioPlayer.pause();
      goalPromptAudioPlayer.currentTime = 0;
    } catch {}
    goalPromptAudioPlayer = null;
  }
}

/**
 * Preload all Maya Challenge Voice audio assets into memory
 */
export function preloadChallengeVoices(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const promptUri = getAssetUri(MAYA_CHALLENGE_PROMPT_ASSET);
      if (promptUri) {
        getPreloadedAudio(promptUri).load();
      }
      Object.values(CHALLENGE_AUDIO_ASSETS).forEach((asset) => {
        const uri = getAssetUri(asset);
        if (uri) {
          const audio = getPreloadedAudio(uri);
          audio.load();
        }
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
export function playMayaChallengePromptVoice(callbacks?: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  stopMayaChallengePromptVoice();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(MAYA_CHALLENGE_PROMPT_ASSET);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        challengePromptAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (challengePromptAudioPlayer === audio) {
            challengePromptAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (challengePromptAudioPlayer === audio) {
            challengePromptAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (challengePromptAudioPlayer === audio) {
              challengePromptAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaChallengePromptVoice(): void {
  if (challengePromptAudioPlayer) {
    try {
      challengePromptAudioPlayer.onended = null;
      challengePromptAudioPlayer.onerror = null;
      challengePromptAudioPlayer.pause();
      challengePromptAudioPlayer.currentTime = 0;
    } catch {}
    challengePromptAudioPlayer = null;
  }
}

/**
 * 9. Maya's Personalized Goal Selection Feedback Voices
 * Plays tailored encouragement when user selects their goal.
 */
export function playMayaGoalFeedbackVoice(
  goalId: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): void {
  stopMayaGoalPromptVoice();
  stopMayaGoalFeedbackVoice();

  const asset = GOAL_AUDIO_ASSETS[goalId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        goalAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (goalAudioPlayer === audio) {
            goalAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (goalAudioPlayer === audio) {
            goalAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (goalAudioPlayer === audio) {
              goalAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaGoalFeedbackVoice(): void {
  if (goalAudioPlayer) {
    try {
      goalAudioPlayer.onended = null;
      goalAudioPlayer.onerror = null;
      goalAudioPlayer.pause();
      goalAudioPlayer.currentTime = 0;
    } catch {}
    goalAudioPlayer = null;
  }
}

/**
 * 10. Maya's Personalized Challenge Selection Feedback Voices
 * Plays tailored encouragement when user selects their biggest challenge.
 */
export function playMayaChallengeFeedbackVoice(
  challengeId: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
): void {
  stopMayaChallengePromptVoice();
  stopMayaChallengeFeedbackVoice();

  const asset = CHALLENGE_AUDIO_ASSETS[challengeId];
  if (!asset) {
    callbacks?.onEnd?.();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const uri = getAssetUri(asset);
      if (uri) {
        const audio = getPreloadedAudio(uri);
        challengeAudioPlayer = audio;
        audio.currentTime = 0;
        audio.volume = 1.0;

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          if (challengeAudioPlayer === audio) {
            challengeAudioPlayer = null;
          }
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          if (challengeAudioPlayer === audio) {
            challengeAudioPlayer = null;
          }
          callbacks?.onError?.(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (challengeAudioPlayer === audio) {
              challengeAudioPlayer = null;
            }
            callbacks?.onError?.(err);
          });
        }
        return;
      }
    } catch (err) {
      callbacks?.onError?.(err);
      return;
    }
  }

  callbacks?.onError?.(new Error('Audio playback not supported on this platform'));
}

export function stopMayaChallengeFeedbackVoice(): void {
  if (challengeAudioPlayer) {
    try {
      challengeAudioPlayer.onended = null;
      challengeAudioPlayer.onerror = null;
      challengeAudioPlayer.pause();
      challengeAudioPlayer.currentTime = 0;
    } catch {}
    challengeAudioPlayer = null;
  }
}





