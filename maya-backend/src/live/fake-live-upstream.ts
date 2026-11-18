/**
 * Fake Gemini Live upstream for cost-free load testing (rule: cost-safe testing).
 *
 * Enabled only when LIVE_FAKE_UPSTREAM=1 AND NODE_ENV !== 'production', so it can never
 * replace the real model in the production container. It implements the subset of the
 * @google/genai live session the gateway uses, and replies to each user turn the way the
 * real API does: input transcription, then ~24 kHz PCM16 audio streamed in real time with
 * output transcription, then turnComplete + usageMetadata. Everything downstream (buffers,
 * resampling, Opus, recordings, finalize) runs for real, so CPU/RAM numbers are honest.
 */

export interface FakeLiveCallbacks {
  onopen?: () => void;
  onmessage?: (msg: any) => void;
  onerror?: (err: any) => void;
  onclose?: (e: any) => void;
}

export function isFakeLiveUpstreamEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LIVE_FAKE_UPSTREAM === '1' && env.NODE_ENV !== 'production';
}

const SAMPLE_RATE = 24000;
const CHUNK_MS = 40; // Gemini sends small audio chunks; 40ms = 960 samples = 1920 bytes
const SAMPLES_PER_CHUNK = (SAMPLE_RATE * CHUNK_MS) / 1000;

/** Reply length per turn, ms of model speech (env-tunable for heavier profiles). */
function replyDurationMs(): number {
  const min = Number(process.env.LIVE_FAKE_REPLY_MIN_MS || 2500);
  const max = Number(process.env.LIVE_FAKE_REPLY_MAX_MS || 5000);
  return Math.round(min + Math.random() * Math.max(0, max - min));
}
const FIRST_AUDIO_DELAY_MS = Number(process.env.LIVE_FAKE_LATENCY_MS || 600);

/** Speech-like PCM16: a few drifting harmonics with a syllable-rate envelope plus noise. */
function synthChunk(startSample: number): Buffer {
  const buf = Buffer.alloc(SAMPLES_PER_CHUNK * 2);
  for (let i = 0; i < SAMPLES_PER_CHUNK; i++) {
    const n = startSample + i;
    const t = n / SAMPLE_RATE;
    const f0 = 170 + 30 * Math.sin(2 * Math.PI * 0.7 * t);
    const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t); // ~4 syllables/s
    const v =
      env *
      (0.5 * Math.sin(2 * Math.PI * f0 * t) +
        0.25 * Math.sin(2 * Math.PI * 2 * f0 * t) +
        0.12 * Math.sin(2 * Math.PI * 3 * f0 * t)) +
      0.03 * (Math.random() * 2 - 1);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 9000))), i * 2);
  }
  return buf;
}

const WORDS = 'that sounds great tell me more about what you enjoy doing on weekends and why'.split(' ');

export class FakeLiveSession {
  private closed = false;
  private replyTimer: ReturnType<typeof setTimeout> | null = null;
  private streamTimer: ReturnType<typeof setInterval> | null = null;
  private replying = false;
  private userAudioBytes = 0;
  private turnCount = 0;

  constructor(private readonly cb: FakeLiveCallbacks) {}

  /** Mirrors the connect handshake: open, then setupComplete. */
  start(): void {
    setTimeout(() => {
      if (this.closed) return;
      this.cb.onopen?.();
      this.emit({ setupComplete: {} });
    }, 50);
  }

  sendRealtimeInput(input: any): void {
    if (this.closed) return;
    if (input?.audio?.data || input?.media?.data) {
      const b64 = input.audio?.data || input.media?.data;
      this.userAudioBytes += Math.floor((b64.length * 3) / 4);
    }
    if (input?.activityStart && this.replying) this.interrupt();
    if (input?.activityEnd) this.scheduleReply();
  }

  sendClientContent(content: any): void {
    if (this.closed) return;
    if (content?.turnComplete !== false) this.scheduleReply();
  }

  sendToolResponse(): void {
    /* no tools in the fake */
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopReply();
    setTimeout(() => this.cb.onclose?.({ reason: 'Normal' }), 0);
  }

  private emit(msg: any): void {
    if (!this.closed) this.cb.onmessage?.(msg);
  }

  private stopReply(): void {
    if (this.replyTimer) clearTimeout(this.replyTimer);
    if (this.streamTimer) clearInterval(this.streamTimer);
    this.replyTimer = null;
    this.streamTimer = null;
    this.replying = false;
  }

  private interrupt(): void {
    this.stopReply();
    this.emit({ serverContent: { interrupted: true } });
  }

  private scheduleReply(): void {
    if (this.replying || this.replyTimer) return;
    const userSeconds = this.userAudioBytes / (16000 * 2);
    this.userAudioBytes = 0;
    this.turnCount++;
    this.emit({
      serverContent: { inputTranscription: { text: `fake user turn ${this.turnCount} (${userSeconds.toFixed(1)}s)` } },
    });

    this.replyTimer = setTimeout(() => {
      this.replyTimer = null;
      if (this.closed) return;
      this.replying = true;
      const totalChunks = Math.max(1, Math.round(replyDurationMs() / CHUNK_MS));
      let sent = 0;
      let sample = 0;
      let word = 0;
      this.streamTimer = setInterval(() => {
        if (this.closed) return this.stopReply();
        const chunk = synthChunk(sample);
        sample += SAMPLES_PER_CHUNK;
        sent++;
        const serverContent: any = {
          modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: chunk.toString('base64') } }] },
        };
        if (sent % 8 === 0) {
          serverContent.outputTranscription = { text: WORDS[word++ % WORDS.length] + ' ' };
        }
        this.emit({ serverContent });

        if (sent >= totalChunks) {
          this.stopReply();
          this.emit({ serverContent: { turnComplete: true } });
          const outTokens = Math.round((totalChunks * CHUNK_MS) / 1000 * 25);
          this.emit({
            usageMetadata: {
              promptTokenCount: 400 + Math.round(userSeconds * 25),
              responseTokenCount: outTokens,
              totalTokenCount: 400 + Math.round(userSeconds * 25) + outTokens,
            },
          });
        }
      }, CHUNK_MS);
    }, FIRST_AUDIO_DELAY_MS);
  }
}

/** Drop-in for `ai.live.connect(params)`. */
export async function connectFakeLiveSession(params: { callbacks?: FakeLiveCallbacks }): Promise<FakeLiveSession> {
  const session = new FakeLiveSession(params?.callbacks || {});
  session.start();
  return session;
}
