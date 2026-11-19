import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getMayaVoiceLevel, shapeOutputLevel } from '@/services/audio/voice-meter';

/**
 * Maps a raw voice RMS level (normal speech is only ~0.02-0.15 of 0..1) to a visible 0..1:
 * subtracts a small noise floor, boosts and applies a gentle curve so ordinary speech moves the
 * visuals clearly while shouting does not simply max everything out.
 */
export function shapeVoiceLevel(raw: number, noiseFloor = 0.012, gain = 4.2): number {
  if (!Number.isFinite(raw) || raw <= noiseFloor) return 0;
  const v = Math.min(1, (raw - noiseFloor) * gain);
  return Math.pow(v, 0.65);
}

/**
 * Smoothed, shaped voice level as an Animated.Value, updated every frame WITHOUT re-rendering:
 * fast attack (~60 ms) so syllables pop, slow release (~260 ms) so it pulses instead of flickering.
 * `minActive` keeps a visible floor while someone is talking, so it never looks dead.
 */
export function useSmoothedVoiceLevel(
  raw: number,
  active: boolean,
  minActive = 0.18,
  /** Read Maya's live playback loudness every frame instead of `raw` (word-synced). */
  liveMaya = false,
): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const liveRef = useRef(liveMaya);
  liveRef.current = liveMaya;

  useEffect(() => {
    const shaped = shapeVoiceLevel(raw);
    targetRef.current = active ? Math.max(minActive, shaped) : shaped * 0.5;
  }, [raw, active, minActive]);

  useEffect(() => {
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(64, now - last);
      last = now;
      const live = liveRef.current;
      const target = live ? shapeOutputLevel(getMayaVoiceLevel()) : targetRef.current;
      const cur = currentRef.current;
      // attack / release (ms): live voice uses a faster release so gaps between words show
      const tau = target > cur ? (live ? 25 : 60) : live ? 140 : 260;
      const next = cur + (target - cur) * (1 - Math.exp(-dt / tau));
      if (Math.abs(next - cur) > 0.001) {
        currentRef.current = next;
        value.setValue(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return value;
}
