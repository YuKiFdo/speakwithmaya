/**
 * SpeechSyncTimeline
 * ------------------
 * Keeps Maya's on-screen words in step with the audio that is actually being
 * PLAYED (not the audio/text that has merely ARRIVED).
 *
 * Why this is needed: Gemini Live generates audio and transcript faster than
 * real time, so both arrive in bursts well ahead of the speaker. Revealing
 * words as the transcript arrives (or on a fixed timer) always drifts from the
 * voice. Instead we:
 *
 *  1. model the audio playback clock (every chunk handed to the player is
 *     scheduled back-to-back, exactly like an AudioContext queue),
 *  2. give every transcript word a start offset on that audio axis using its
 *     length (plus pauses after punctuation) and a speech rate that is
 *     calibrated from the audio duration received so far,
 *  3. reveal a word when the playback position reaches its start offset.
 *
 * The rate is exact once the turn is complete, and clamped to natural speech
 * limits while the turn is still streaming.
 *
 * If your AudioPlayer can report its real playback position, you can replace
 * `getPlayheadSec` with that value for perfect sync (see setLatencyMs below
 * for fine tuning in the meantime).
 */

export interface SpeechSyncSource {
  /** Number of words of the current reply that should be visible right now. */
  getRevealedCount(nowMs?: number): number;
  /** Number of transcript words known for the current reply. */
  getWordCount(): number;
  /** Increments every time a new Maya reply starts. Use as a turn id. */
  getTurnSeq(): number;
  /** True while audio is playing or words are still waiting to be revealed. */
  isBusy(nowMs?: number): boolean;
}

interface Segment {
  wallStart: number; // ms: when this block of audio starts playing (before latency)
  audioStart: number; // sec on the global audio axis
  dur: number; // sec
}

// Output latency = player jitter buffer (150/250/350ms) + device output (~60ms)
const DEFAULT_LATENCY_MS = 210;
// Show a word slightly BEFORE it is spoken (captions that trail speech feel laggy)
const DEFAULT_LEAD_MS = 60;

const DEFAULT_RATE = 0.058; // sec per weight unit (~2.6 words/sec)
const MIN_RATE = 0.04;
const MAX_RATE = 0.09;
const FINAL_MIN_RATE = 0.03;
const FINAL_MAX_RATE = 0.14;
const FALLBACK_SEC_PER_WORD = 0.33; // only used if a transcript arrives with no audio at all
const QUIET_REVEAL_ALL_MS = 600; // audio finished + no new audio -> show everything

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rough "how long does this word take to say" weight. */
function wordWeight(word: string): number {
  const letters = word.replace(/[.,!?;:"'()\[\]{}\-\u2013\u2014*_]/g, '').length;
  let w = Math.max(1, letters) + 1.5;
  if (/[.?!]["')\]]*$/.test(word)) w += 5; // sentence pause
  else if (/[,;:]$/.test(word)) w += 2.5; // clause pause
  return w;
}

export class SpeechSyncTimeline implements SpeechSyncSource {
  // ---- audio playback model (global axis, never reset except on reset()) ----
  private segments: Segment[] = [];
  private queuedSec = 0;
  private scheduledEndMs = 0;
  private latencyMs = DEFAULT_LATENCY_MS;
  private leadMs = DEFAULT_LEAD_MS;

  // ---- current Maya reply ----
  private turnSeq = 0;
  private turnOpen = false;
  private finalized = true;
  private nextBaseSec: number | null = null; // audio start of the upcoming reply
  private turnBaseSec = 0;
  private turnEndSec = 0;
  private turnStartWallMs = 0;
  private cumBefore: number[] = []; // weight before each word
  private totalWeight = 0;
  private frozenCount: number | null = null;
  private lastCount = 0;

  /* ----------------------------- configuration ---------------------------- */

  setLatencyMs(ms: number) {
    this.latencyMs = Math.max(0, ms);
  }

  setLeadMs(ms: number) {
    this.leadMs = Math.max(0, ms);
  }

  /* ------------------------------ audio input ----------------------------- */

  /** Call right when a chunk is handed to the audio player. */
  onAudio(durationSec: number, nowMs: number = Date.now()) {
    if (!(durationSec > 0)) return;

    if (!this.turnOpen && this.nextBaseSec === null) {
      this.nextBaseSec = this.queuedSec; // first audio of the next reply
    }

    const start = Math.max(nowMs, this.scheduledEndMs);
    const last = this.segments[this.segments.length - 1];
    if (
      last &&
      Math.abs(last.audioStart + last.dur - this.queuedSec) < 1e-6 &&
      Math.abs(last.wallStart + last.dur * 1000 - start) < 3
    ) {
      last.dur += durationSec;
    } else {
      this.segments.push({ wallStart: start, audioStart: this.queuedSec, dur: durationSec });
    }
    this.scheduledEndMs = start + durationSec * 1000;
    this.queuedSec += durationSec;
    this.prune(nowMs);
  }

  /* ----------------------------- transcript input ------------------------- */

  /** Call at the first transcript chunk of a new Maya reply. */
  startTurn(nowMs: number = Date.now()) {
    this.turnSeq += 1;
    this.turnBaseSec = this.nextBaseSec ?? this.queuedSec;
    this.nextBaseSec = null;
    this.turnOpen = true;
    this.finalized = false;
    this.frozenCount = null;
    this.cumBefore = [];
    this.totalWeight = 0;
    this.lastCount = 0;
    this.turnStartWallMs = nowMs;
  }

  /** Call with the FULL word list of the reply so far (cumulative). */
  updateWords(words: string[]) {
    if (!this.turnOpen) return;
    for (let i = this.cumBefore.length; i < words.length; i++) {
      this.cumBefore.push(this.totalWeight);
      this.totalWeight += wordWeight(words[i]);
    }
  }

  /** Call on turnComplete: all audio + words of the reply are known now. */
  endTurn() {
    if (!this.turnOpen) return;
    this.turnOpen = false;
    this.finalized = true;
    this.turnEndSec = this.queuedSec;
  }

  /**
   * Call whenever playback is cut (barge-in, manual interrupt, watchdog).
   * The text freezes exactly where the voice stopped.
   */
  interrupt(nowMs: number = Date.now()) {
    const count = this.cumBefore.length > 0 ? this.getRevealedCount(nowMs) : null;
    const p = this.getPlayheadSec(nowMs);

    const kept: Segment[] = [];
    for (const s of this.segments) {
      if (s.audioStart >= p) break;
      kept.push({ ...s, dur: Math.min(s.dur, p - s.audioStart) });
    }
    this.segments = kept;
    this.queuedSec = Math.min(this.queuedSec, p);
    this.scheduledEndMs = Math.min(this.scheduledEndMs, nowMs);

    this.frozenCount = count;
    this.turnOpen = false;
    this.finalized = true;
    this.turnEndSec = this.queuedSec;
    this.nextBaseSec = null;
  }

  reset() {
    this.segments = [];
    this.queuedSec = 0;
    this.scheduledEndMs = 0;
    this.turnOpen = false;
    this.finalized = true;
    this.nextBaseSec = null;
    this.turnBaseSec = 0;
    this.turnEndSec = 0;
    this.cumBefore = [];
    this.totalWeight = 0;
    this.frozenCount = null;
    this.lastCount = 0;
    this.turnSeq += 1;
  }

  /* -------------------------------- queries ------------------------------- */

  getTurnSeq() {
    return this.turnSeq;
  }

  getWordCount() {
    return this.cumBefore.length;
  }

  isBusy(nowMs: number = Date.now()) {
    if (this.frozenCount !== null) return false;
    return this.lastCount < this.cumBefore.length || nowMs - this.latencyMs < this.scheduledEndMs;
  }

  getRevealedCount(nowMs: number = Date.now()): number {
    if (this.frozenCount !== null) return this.frozenCount;
    const total = this.cumBefore.length;
    if (total === 0) return 0;

    const audioSec = (this.finalized ? this.turnEndSec : this.queuedSec) - this.turnBaseSec;
    let count: number;

    if (audioSec <= 0.02) {
      // Transcript with no audio at all (yet): gentle fixed pacing
      count = Math.floor((nowMs - this.turnStartWallMs) / (FALLBACK_SEC_PER_WORD * 1000)) + 1;
    } else {
      const quietMs = nowMs - (this.scheduledEndMs + this.latencyMs);
      if ((this.finalized && quietMs >= 0) || (!this.finalized && quietMs >= QUIET_REVEAL_ALL_MS)) {
        count = total; // everything has been spoken
      } else {
        const rel = this.getPlayheadSec(nowMs) - this.turnBaseSec + this.leadMs / 1000;
        const rate = this.rate(audioSec);
        let n = this.lastCount;
        while (n < total && this.cumBefore[n] * rate <= rel) n += 1;
        count = n;
      }
    }

    count = Math.min(total, Math.max(count, this.lastCount)); // never go backwards
    this.lastCount = count;
    return count;
  }

  /* -------------------------------- internals ----------------------------- */

  private rate(audioSec: number): number {
    const W = this.totalWeight;
    if (W <= 0) return DEFAULT_RATE;
    const measured = audioSec / W;
    if (this.finalized) return clamp(measured, FINAL_MIN_RATE, FINAL_MAX_RATE);
    // Still streaming: transcript may lag the audio, so trust the measurement
    // only gradually and keep it inside natural speech limits.
    const confidence = Math.min(1, audioSec / 4) * 0.6;
    return clamp(DEFAULT_RATE + confidence * (measured - DEFAULT_RATE), MIN_RATE, MAX_RATE);
  }

  /** Seconds of audio that have actually been played, on the global axis. */
  private getPlayheadSec(nowMs: number): number {
    const segs = this.segments;
    if (segs.length === 0) return this.queuedSec;
    const t = nowMs - this.latencyMs;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      const elapsed = (t - s.wallStart) / 1000;
      if (elapsed >= 0) return s.audioStart + Math.min(elapsed, s.dur);
    }
    return segs[0].audioStart;
  }

  private prune(nowMs: number) {
    const horizon = nowMs - this.latencyMs - 15000;
    while (
      this.segments.length > 2 &&
      this.segments[0].wallStart + this.segments[0].dur * 1000 < horizon
    ) {
      this.segments.shift();
    }
  }
}