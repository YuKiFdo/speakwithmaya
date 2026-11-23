import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { loadOpusEncoderFactory } from './opus-loader.js';
import { buildSessionAudioFiles, packSessionAudio, type SessionAudioFiles, type SessionAudioInput } from './audio-codec.js';

class JobTimeoutError extends Error {
  constructor() {
    super('audio finalize job timed out');
  }
}

/**
 * Runs buildSessionAudioFiles in a dedicated worker thread so finishing sessions never
 * blocks the event loop that streams live calls. Falls back to inline work when the
 * compiled worker is missing (TS sources under vitest) or the worker fails.
 */
export class AudioFinalizeClient {
  private readonly logger = new Logger('AudioFinalize');
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  /**
   * Admission control. The worker is one thread, so running jobs one at a time loses nothing,
   * and it keeps each job's packed PCM copy from existing until its turn. Without it, 50 calls
   * ending together each packed their whole call at once (load test: ~1.9 GB peak, a full core
   * for a minute on the main thread). High-priority jobs (turn clips, playback conversions:
   * someone is waiting) go ahead of low-priority ones (full-conversation recordings).
   */
  private static readonly MAX_CONCURRENT_JOBS = 1;
  private running = 0;
  private readonly waiting: Array<{ high: boolean; start: () => void }> = [];

  private acquire(high: boolean): Promise<void> {
    if (this.running < AudioFinalizeClient.MAX_CONCURRENT_JOBS) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((start) => {
      const job = { high, start };
      const firstLow = high ? this.waiting.findIndex((j) => !j.high) : -1;
      if (firstLow === -1) this.waiting.push(job);
      else this.waiting.splice(firstLow, 0, job);
    });
  }

  /** Hands the slot straight to the next waiting job, so no new caller can slip in between. */
  private release(): void {
    const next = this.waiting.shift();
    if (next) next.start();
    else this.running--;
  }

  private async withSlot<T>(high: boolean, fn: () => Promise<T>): Promise<T> {
    await this.acquire(high);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Jobs waiting for the worker (for diagnostics and tests). */
  get queuedJobs(): number {
    return this.waiting.length;
  }

  constructor(private readonly workerUrl: URL = new URL('./audio-finalize.worker.js', import.meta.url)) {}

  isAvailable(): boolean {
    try {
      return existsSync(fileURLToPath(this.workerUrl));
    } catch {
      return false;
    }
  }

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (!this.isAvailable()) return null;
    // execArgv: [] so the worker never inherits flags like --input-type from the parent
    const w = new Worker(this.workerUrl, { execArgv: [] });
    w.unref();
    w.on('message', (msg: any) => {
      const p = this.pending.get(msg?.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (!msg.ok) return p.reject(new Error(msg.message || 'audio finalize failed'));
      if (msg.wav) return p.resolve(Buffer.from(msg.wav.buffer, msg.wav.byteOffset, msg.wav.byteLength));
      const f = msg.files;
      const buf = (u?: Uint8Array) => (u ? Buffer.from(u.buffer, u.byteOffset, u.byteLength) : undefined);
      p.resolve({
        mime: f.mime,
        ext: f.ext,
        full: buf(f.full),
        userTurns: f.userTurns.map(([k, v]: [number, Uint8Array]) => [k, buf(v)!]),
        modelTurns: f.modelTurns.map(([k, v]: [number, Uint8Array]) => [k, buf(v)!]),
      });
    });
    const failAll = (err: Error) => {
      for (const [id, p] of this.pending) {
        p.reject(err);
        this.pending.delete(id);
      }
      this.worker = null; // a fresh worker is started for the next job
    };
    w.on('error', (err) => {
      this.logger.warn(`audio-finalize worker error: ${err?.message}`);
      failAll(err instanceof Error ? err : new Error(String(err)));
    });
    w.on('exit', (code) => {
      if (this.worker === w) failAll(new Error(`audio-finalize worker exited (${code})`));
    });
    this.worker = w;
    return w;
  }

  /**
   * Builds the session's files off the main thread (inline only if no worker is usable).
   * `priority: 'low'` for work nobody is waiting on (the full-conversation recording).
   */
  build(input: SessionAudioInput, opts: { priority?: 'high' | 'low' } = {}): Promise<SessionAudioFiles> {
    return this.withSlot(opts.priority !== 'low', () => this.buildNow(input));
  }

  private async buildNow(input: SessionAudioInput): Promise<SessionAudioFiles> {
    const w = this.getWorker();
    if (!w) return buildSessionAudioFiles(input, this.inlineOpus());
    try {
      // Structured-cloning ~tens of MB of PCM in many Buffers blocked the main thread longer
      // than encoding did. Pack everything into ONE ArrayBuffer (copied in slices, yielding
      // between them) and TRANSFER it to the worker with zero copy.
      const { packed, layout } = await packSessionAudio(input);
      return await this.postJob<SessionAudioFiles>(w, { packed, layout }, [packed]);
    } catch (err: any) {
      // A stuck job would be just as slow inline, but on the thread that streams live calls.
      if (err instanceof JobTimeoutError) throw err;
      this.logger.warn(`audio-finalize worker failed (${err?.message}); building inline`);
      return buildSessionAudioFiles(input, this.inlineOpus());
    }
  }

  /** Longest a single job may take; far above a 30-min recording, which encodes in seconds. */
  private static readonly JOB_TIMEOUT_MS = 180_000;

  /**
   * Sends one job and waits for its reply. With one job at a time, a hung worker would stall
   * every later recording, so a job that runs past the timeout restarts the worker.
   */
  private postJob<T>(w: Worker, msg: Record<string, unknown>, transfer: ArrayBuffer[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.logger.warn(`audio-finalize job timed out after ${AudioFinalizeClient.JOB_TIMEOUT_MS / 1000}s; restarting worker`);
        if (this.worker === w) this.worker = null; // next job starts a fresh worker
        for (const [pid, p] of this.pending) {
          this.pending.delete(pid);
          p.reject(new JobTimeoutError());
        }
        void w.terminate();
      }, AudioFinalizeClient.JOB_TIMEOUT_MS);
      timer.unref?.();
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      w.postMessage({ ...msg, id }, transfer);
    });
  }

  private inlineOpusFactory?: ReturnType<typeof loadOpusEncoderFactory> | null;
  private inlineOpus() {
    if (this.inlineOpusFactory === undefined) this.inlineOpusFactory = loadOpusEncoderFactory() ?? null;
    return this.inlineOpusFactory ?? undefined;
  }

  /** Decodes a WebM/Opus recording to WAV in the worker (null if unavailable/failed). */
  webmToWav(webm: Buffer): Promise<Buffer | null> {
    return this.withSlot(true, () => this.webmToWavNow(webm));
  }

  private async webmToWavNow(webm: Buffer): Promise<Buffer | null> {
    const w = this.getWorker();
    if (!w) return null; // never decode on the main thread: it is CPU-heavy for long files
    try {
      const data = new Uint8Array(webm.length);
      data.set(webm);
      return await this.postJob<Buffer>(w, { kind: 'webm2wav', data: data.buffer }, [data.buffer]);
    } catch (err: any) {
      this.logger.warn(`webm->wav conversion failed: ${err?.message}`);
      return null;
    }
  }

  async dispose(): Promise<void> {
    const w = this.worker;
    this.worker = null;
    if (w) await w.terminate();
  }
}

