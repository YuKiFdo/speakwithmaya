import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';

export interface PiperSegment {
  ids: number[];
  pauseSamples: number;
}

interface Pending {
  resolve: (pcm: Buffer) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Owns a single Piper inference worker thread. Requests are processed one at a
 * time inside the worker, so at most one vCPU is used for TTS and the main
 * event loop is never blocked by ONNX inference.
 */
export class PiperWorkerClient {
  private readonly logger = new Logger('PiperWorkerClient');
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private disposing = false;

  constructor(
    private readonly modelPath: string,
    private readonly workerUrl: URL = new URL('./piper-inference.worker.js', import.meta.url),
  ) {}

  /** True when the compiled worker file exists (it does not when running TS sources under vitest). */
  static isAvailable(workerUrl: URL = new URL('./piper-inference.worker.js', import.meta.url)): boolean {
    try {
      return existsSync(fileURLToPath(workerUrl));
    } catch {
      return false;
    }
  }

  private start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const worker = new Worker(this.workerUrl);
      this.worker = worker;
      // Never keep the process alive just for the TTS worker.
      worker.unref();

      const onInitMessage = (msg: any) => {
        if (msg?.type === 'ready') {
          worker.off('message', onInitMessage);
          worker.on('message', (m) => this.onMessage(m));
          resolve();
        } else if (msg?.type === 'init_error') {
          worker.off('message', onInitMessage);
          reject(new Error(msg.message));
          void worker.terminate();
        }
      };
      worker.on('message', onInitMessage);
      worker.on('error', (err) => {
        this.logger.warn(`Piper worker error: ${err?.message}`);
        this.failAll(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      });
      worker.on('exit', (code) => {
        if (code !== 0 && !this.disposing) this.logger.warn(`Piper worker exited with code ${code}`);
        this.failAll(new Error(`Piper worker exited (${code})`));
        this.worker = null;
        this.readyPromise = null;
      });
      worker.postMessage({ type: 'init', modelPath: this.modelPath });
    });

    this.readyPromise.catch(() => {
      this.readyPromise = null;
      this.worker = null;
    });
    return this.readyPromise;
  }

  private onMessage(msg: any) {
    const p = this.pending.get(msg?.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.type === 'result') {
      p.resolve(Buffer.from(msg.pcm as ArrayBuffer));
    } else {
      p.reject(new Error(msg.message || 'Piper worker synthesis failed'));
    }
  }

  private failAll(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }

  async init(): Promise<void> {
    await this.start();
  }

  /** Returns 16-bit mono PCM for the given phoneme-id segments. */
  async synthesize(segments: PiperSegment[]): Promise<Buffer> {
    await this.start();
    const worker = this.worker;
    if (!worker) throw new Error('Piper worker unavailable');
    const id = this.nextId++;
    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Piper synthesis timed out'));
      }, REQUEST_TIMEOUT_MS);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'synthesize', id, segments });
    });
  }

  async dispose(): Promise<void> {
    this.disposing = true;
    this.failAll(new Error('Piper worker disposed'));
    if (this.worker) await this.worker.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}
