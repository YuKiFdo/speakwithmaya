import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { loadOpusEncoderFactory } from './opus-loader.js';
import { buildSessionAudioFiles, packSessionAudio, type SessionAudioFiles, type SessionAudioInput } from './audio-codec.js';

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

  /** Builds the session's files off the main thread (inline only if no worker is usable). */
  async build(input: SessionAudioInput): Promise<SessionAudioFiles> {
    const w = this.getWorker();
    if (!w) return buildSessionAudioFiles(input, this.inlineOpus());
    try {
      // Structured-cloning ~tens of MB of PCM in many Buffers blocked the main thread longer
      // than encoding did. Pack everything into ONE ArrayBuffer (copied in slices, yielding
      // between them) and TRANSFER it to the worker with zero copy.
      const { packed, layout } = await packSessionAudio(input);
      return await new Promise<SessionAudioFiles>((resolve, reject) => {
        const id = this.nextId++;
        this.pending.set(id, { resolve, reject });
        w.postMessage({ id, packed, layout }, [packed]);
      });
    } catch (err: any) {
      this.logger.warn(`audio-finalize worker failed (${err?.message}); building inline`);
      return buildSessionAudioFiles(input, this.inlineOpus());
    }
  }

  private inlineOpusFactory?: ReturnType<typeof loadOpusEncoderFactory> | null;
  private inlineOpus() {
    if (this.inlineOpusFactory === undefined) this.inlineOpusFactory = loadOpusEncoderFactory() ?? null;
    return this.inlineOpusFactory ?? undefined;
  }

  /** Decodes a WebM/Opus recording to WAV in the worker (null if unavailable/failed). */
  async webmToWav(webm: Buffer): Promise<Buffer | null> {
    const w = this.getWorker();
    if (!w) return null; // never decode on the main thread: it is CPU-heavy for long files
    try {
      const data = new Uint8Array(webm.length);
      data.set(webm);
      return await new Promise<Buffer>((resolve, reject) => {
        const id = this.nextId++;
        this.pending.set(id, { resolve, reject });
        w.postMessage({ id, kind: 'webm2wav', data: data.buffer }, [data.buffer]);
      });
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

