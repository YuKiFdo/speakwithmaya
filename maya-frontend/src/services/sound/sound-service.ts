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

let audioCtx: AudioContext | null = null;
let activeWhooshNodes: { noise: AudioBufferSourceNode; gain: GainNode } | null = null;

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
  }, 1000);
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
): void {
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
        // Fallback timeout in case browser onended does not fire
        setTimeout(notifyEnded, 2200);

        player.play().catch(() => {
          try {
            audio.currentTime = 0;
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.onended = notifyEnded;
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
 */
export function playHintButtonSound(): void {
  console.log('[sound-service] 💡 playHintButtonSound() called');
  playSoundAsset(HINT_BUTTON_ASSET, 0.8, () => {
    playStepPop(2);
  });
}

/**
 * Other Button Press Sound (other button press.mp3)
 * Plays for interactive toggles, controls, and secondary buttons.
 */
export function playOtherButtonSound(): void {
  console.log('[sound-service] 🔘 playOtherButtonSound() called');
  playSoundAsset(OTHER_BUTTON_ASSET, 0.75, () => {
    playStepPop(0);
  });
}

/**
 * Understood Button Press Sound (understood button press.mp3)
 * Plays when tapping "Understood" cards, feedback ratings, and session-review actions.
 */
export function playUnderstoodTapSound(): void {
  console.log('[sound-service] 👍 playUnderstoodTapSound() called');
  playSoundAsset(UNDERSTOOD_BUTTON_ASSET, 0.8, () => {
    playSynthesizedUnderstoodTap();
  });
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
