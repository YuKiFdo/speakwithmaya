/**
 * Maya's live voice level, read every animation frame by the speaking glow and the voice orb.
 *
 * The old volume came from each audio CHUNK when it ARRIVED (one average per chunk, and Gemini
 * sends audio faster than real time), so visuals moved ahead of her words and then sat still.
 * This meter answers "how loud is Maya at this exact moment of playback":
 *  - web: an AnalyserNode on the player output (what the speaker is playing right now)
 *  - native: each chunk is split into 20 ms slices scheduled at the time they will be heard
 */

const FRAME_MS = 20;
const SAMPLE_RATE = 24000;

/** Time-scheduled loudness slices (native, and the web fallback before the analyser exists). */
export class PlaybackEnvelope {
  private frames: Array<{ at: number; level: number }> = [];
  private playheadEnd = 0;

  /** `startDelayMs`: the player's own buffering before a fresh turn starts sounding. */
  constructor(private readonly startDelayMs = 0) {}

  /** Add one chunk of 24 kHz mono samples; it plays right after what is already queued. */
  push(samples: ArrayLike<number>, scale = 1) {
    const now = Date.now();
    let start = this.playheadEnd > now ? this.playheadEnd : now + this.startDelayMs;
    const per = Math.round((SAMPLE_RATE * FRAME_MS) / 1000);
    for (let i = 0; i < samples.length; i += per) {
      let sum = 0;
      const end = Math.min(samples.length, i + per);
      for (let j = i; j < end; j++) {
        const v = samples[j] * scale;
        sum += v * v;
      }
      this.frames.push({ at: start, level: Math.sqrt(sum / Math.max(1, end - i)) });
      start += ((end - i) / SAMPLE_RATE) * 1000;
    }
    this.playheadEnd = start;
    // Keep the buffer small
    if (this.frames.length > 4000) this.frames.splice(0, this.frames.length - 4000);
  }

  /** Loudness (RMS, 0..~0.5) at this moment of playback. */
  levelNow(): number {
    const now = Date.now();
    while (this.frames.length > 1 && this.frames[1].at <= now) this.frames.shift();
    const f = this.frames[0];
    if (!f || f.at > now || now - f.at > FRAME_MS * 2) return 0;
    return f.level;
  }

  clear() {
    this.frames = [];
    this.playheadEnd = 0;
  }
}

/** Reads the RMS of what an AnalyserNode is currently outputting. */
export function analyserLevel(analyser: AnalyserNode, buf: Float32Array): number {
  analyser.getFloatTimeDomainData(buf as any);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

// ── Global source: the active call's player registers here; visuals read every frame ──
let source: (() => number) | null = null;

export function setMayaVoiceLevelSource(fn: (() => number) | null) {
  source = fn;
}

/** Maya's raw output loudness right now (RMS, about 0..0.4 for speech). 0 when silent. */
export function getMayaVoiceLevel(): number {
  try {
    return source ? source() : 0;
  } catch {
    return 0;
  }
}

/**
 * Maps the RMS loudness to a visible 0..1: speech RMS is ~0.03-0.25, so boost with a gentle
 * curve; quiet gaps between words drop to near zero, which is what makes the motion follow words.
 */
export function shapeOutputLevel(rms: number): number {
  const v = Math.max(0, rms - 0.008) * 5.5;
  return Math.min(1, Math.pow(v, 0.7));
}
