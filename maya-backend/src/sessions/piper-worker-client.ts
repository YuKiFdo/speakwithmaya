import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';

export interface PiperSegment {
  ids: number[];
  pauseSamples: number;
}

export type PiperPriority = 'high' | 'low';

interface Job {
  id: number;
  key?: string;
  priority: PiperPriority;
  segments: PiperSegment[];
  resolve: (pcm: Buffer) => void;
  reject: (err: Error) => void;
}

/**
 * Max time the worker may spend generating ONE clip. It does not include time waiting in
 * the queue: the old 30s timer started at enqueue, so with several clips queued the later
 * ones expired before the worker reached them (and the worker still generated them,
 * wasting CPU and delaying everything behind them).
 */
const PROCESSING_TIMEOUT_MS = 120_000;

/**
 * Owns a single Piper inference worker thread. Jobs are queued here and sent to the
 * worker one at a time (at most one vCPU for TTS; the event loop is never blocked).
 * 'high' jobs (a user is waiting) run before 'low' ones (background prewarm), and a
 * queued job can be promoted when a user asks for the same clip.
 */
export class PiperWorkerClient {
  private readonly logger = new Logger('PiperWorkerClient');
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly queue: Job[] = [];
  private active: { job: Job; timer: ReturnType<typeof setTimeout>; timedOut: boolean } | null = null;
  private nextId = 1;
  /** Keys promoted before their job was enqueued (phonemization is async upstream). */
  private readonly promotedKeys = new Set<string>();
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
    const a = this.active;
    if (!a || a.job.id !== msg?.id) return;
    clearTimeout(a.timer);
    this.active = null;
    if (!a.timedOut) {
      if (msg.type === 'result') a.job.resolve(Buffer.from(msg.pcm as ArrayBuffer));
      else a.job.reject(new Error(msg.message || 'Piper worker synthesis failed'));
    }
    this.pump();
  }

  /** Sends the next job to the worker when it is idle. */
  private pump() {
    if (this.active || !this.worker || this.queue.length === 0) return;
    const idx = this.queue.findIndex((j) => j.priority === 'high');
    const job = this.queue.splice(idx >= 0 ? idx : 0, 1)[0];
    const timer = setTimeout(() => {
      // Reject the caller, but keep the worker marked busy until it actually replies,
      // so the next job never runs concurrently with this one.
      if (this.active?.job === job) this.active.timedOut = true;
      job.reject(new Error('Piper synthesis timed out'));
    }, PROCESSING_TIMEOUT_MS);
    timer.unref?.();
    this.active = { job, timer, timedOut: false };
    this.worker.postMessage({ type: 'synthesize', id: job.id, segments: job.segments });
  }

  private failAll(err: Error) {
    if (this.active) {
      clearTimeout(this.active.timer);
      if (!this.active.timedOut) this.active.job.reject(err);
      this.active = null;
    }
    for (const job of this.queue.splice(0)) job.reject(err);
  }

  /** Number of jobs waiting (excluding the one being generated). */
  get queueLength(): number {
    return this.queue.length;
  }

  /** Moves a queued background job ahead (a user is now waiting for that clip). */
  promote(key: string): void {
    let found = false;
    for (const j of this.queue) {
      if (j.key === key) {
        j.priority = 'high';
        found = true;
      }
    }
    if (!found && this.active?.job.key !== key) {
      if (this.promotedKeys.size > 200) this.promotedKeys.clear();
      this.promotedKeys.add(key);
    }
  }

  async init(): Promise<void> {
    await this.start();
  }

  /** Returns 16-bit mono PCM for the given phoneme-id segments. */
  async synthesize(
    segments: PiperSegment[],
    opts: { priority?: PiperPriority; key?: string } = {},
  ): Promise<Buffer> {
    await this.start();
    if (!this.worker) throw new Error('Piper worker unavailable');
    return new Promise<Buffer>((resolve, reject) => {
      const promoted = !!opts.key && this.promotedKeys.delete(opts.key);
      this.queue.push({
        id: this.nextId++,
        key: opts.key,
        priority: promoted ? 'high' : opts.priority || 'high',
        segments,
        resolve,
        reject,
      });
      this.pump();
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
