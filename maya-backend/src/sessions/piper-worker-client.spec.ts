import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PiperWorkerClient } from './piper-worker-client.js';

// A stand-in worker: replies to each job after `ms` (the job's first id) milliseconds,
// echoing the id in the PCM so the test can see the processing order.
const FAKE_WORKER = `
import { parentPort } from 'node:worker_threads';
let busy = false;
parentPort.on('message', (m) => {
  if (m.type === 'init') return parentPort.postMessage({ type: 'ready' });
  if (m.type === 'synthesize') {
    if (busy) parentPort.postMessage({ type: 'error', id: m.id, message: 'OVERLAP' });
    busy = true;
    const ms = m.segments[0].ids[0];
    setTimeout(() => {
      busy = false;
      const pcm = new Int16Array([m.segments[0].ids[1]]);
      parentPort.postMessage({ type: 'result', id: m.id, pcm: pcm.buffer }, [pcm.buffer]);
    }, ms);
  }
});
`;

let workerUrl: URL;
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'piper-client-'));
  const file = join(dir, 'fake-worker.mjs');
  writeFileSync(file, FAKE_WORKER);
  workerUrl = pathToFileURL(file);
});

const seg = (ms: number, tag: number) => [{ ids: [ms, tag], pauseSamples: 0 }];
const tagOf = (b: Buffer) => b.readInt16LE(0);

describe('PiperWorkerClient queue', () => {
  it('runs one job at a time and serves high priority before queued low priority', async () => {
    const c = new PiperWorkerClient('model.onnx', workerUrl);
    await c.init();
    const order: number[] = [];
    const track = (p: Promise<Buffer>) => p.then((b) => order.push(tagOf(b)));

    const jobs = [
      track(c.synthesize(seg(80, 1), { priority: 'low' })), // starts immediately (worker idle)
      track(c.synthesize(seg(10, 2), { priority: 'low' })),
      track(c.synthesize(seg(10, 3), { priority: 'low' })),
      track(c.synthesize(seg(10, 4), { priority: 'high' })), // jumps the queued lows
    ];
    await Promise.all(jobs);
    expect(order).toEqual([1, 4, 2, 3]);
    await c.dispose();
  });

  it('promote() moves a queued background job ahead', async () => {
    const c = new PiperWorkerClient('model.onnx', workerUrl);
    await c.init();
    const order: number[] = [];
    const track = (p: Promise<Buffer>) => p.then((b) => order.push(tagOf(b)));
    const jobs = [
      track(c.synthesize(seg(60, 1), { priority: 'low', key: 'a' })),
      track(c.synthesize(seg(10, 2), { priority: 'low', key: 'b' })),
      track(c.synthesize(seg(10, 3), { priority: 'low', key: 'c' })),
    ];
    await new Promise((r) => setTimeout(r, 5)); // jobs are queued
    c.promote('c');
    await Promise.all(jobs);
    expect(order).toEqual([1, 3, 2]);
    await c.dispose();
  });

  it('promote() before the job is enqueued still makes it high priority', async () => {
    const c = new PiperWorkerClient('model.onnx', workerUrl);
    await c.init();
    const order: number[] = [];
    const track = (p: Promise<Buffer>) => p.then((b) => order.push(tagOf(b)));
    const a = track(c.synthesize(seg(60, 1), { priority: 'low', key: 'a' }));
    const b = track(c.synthesize(seg(10, 2), { priority: 'low', key: 'b' }));
    c.promote('late'); // user asked while 'late' was still being phonemized
    await new Promise((r) => setTimeout(r, 5));
    const late = track(c.synthesize(seg(10, 3), { priority: 'low', key: 'late' }));
    await Promise.all([a, b, late]);
    expect(order).toEqual([1, 3, 2]);
    await c.dispose();
  });

  it('time spent waiting in the queue does not count toward the timeout', async () => {
    const c = new PiperWorkerClient('model.onnx', workerUrl);
    await c.init();
    // 6 jobs x 300ms = 1.8s total; each still succeeds (old behaviour: a fixed timer from
    // enqueue would expire the later ones under load).
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => c.synthesize(seg(300, i + 1))));
    expect(results.map(tagOf)).toEqual([1, 2, 3, 4, 5, 6]);
    await c.dispose();
  }, 10_000);
});
