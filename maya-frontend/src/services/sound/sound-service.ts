import { Platform } from 'react-native';

/**
 * Maya Gamified Sound Engine
 * Uses the Web Audio API for guaranteed, zero-latency, 100% offline playback.
 */

let audioCtx: AudioContext | null = null;
let activeWhooshNodes: { noise: AudioBufferSourceNode; gain: GainNode } | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    console.log('[sound-service] Non-web platform or SSR environment, skipping Web Audio');
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
      console.log('[sound-service] ⚠️ AudioContext is suspended. Requesting resume()...');
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
 * 1. Gentle Soft Whoosh / Wind Shimmer Sweep
 */
export function playScanningSound(): void {
  console.log('[sound-service] ▶️ playScanningSound() called');
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[sound-service] Cannot play scanning sound: AudioContext unavailable');
    return;
  }

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

    // Audible gain envelope (boosted to 0.45 for clear audibility)
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
    console.log(`[sound-service] 🌬️ Scanning whoosh playing (duration: ${duration}s, ctx.state: "${ctx.state}")`);
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
      console.log('[sound-service] ⏹️ stopScanningSound() called');
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
  console.log(`[sound-service] ▶️ playStepPop(${stepIndex}) called`);
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[sound-service] Cannot play step pop: AudioContext unavailable');
    return;
  }

  try {
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    const targetFreq = freqs[stepIndex % freqs.length] || 523.25;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Downward pitch envelope for punchy juicy pop
    osc.frequency.setValueAtTime(targetFreq * 1.3, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(targetFreq * 0.85, now + 0.18);

    // Master volume for pop
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
    console.log(`[sound-service] 🫧 Step pop played (step: ${stepIndex}, freq: ${targetFreq.toFixed(0)}Hz, ctx.state: "${ctx.state}")`);
  } catch (err) {
    console.error('[sound-service] Step pop error:', err);
  }
}

/**
 * 3. Celebratory Analysis Complete Chime
 */
export function playAnalysisCompleteSound(): void {
  console.log('[sound-service] ▶️ playAnalysisCompleteSound() called');
  stopScanningSound();

  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[sound-service] Cannot play complete sound: AudioContext unavailable');
    return;
  }

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
    console.log(`[sound-service] 🔔 Analysis complete chime played! (ctx.state: "${ctx.state}")`);
  } catch (err) {
    console.error('[sound-service] Complete sound error:', err);
  }
}

/**
 * 4. Juicy Gamified "Understood" Button Click Pop
 * Crisp, modern affirmative tap with a bright rising resonant chime
 */
export function playUnderstoodTapSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Subtle acoustic tactile click
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

    // 2. Bright, rewarding melodic chime (D5 -> A5 rising tone)
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
 * Joyful ascending triad chime (C5 -> E5 -> G5 -> C6) with warm shimmer
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
