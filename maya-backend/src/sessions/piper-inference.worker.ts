/**
 * Piper TTS inference worker.
 *
 * onnxruntime-node executes `InferenceSession.run()` synchronously on the calling
 * thread (its async wrapper only defers via setImmediate). Running it on the main
 * thread blocked the event loop for hundreds of ms per sentence, stalling every
 * HTTP request and live WebSocket. This worker owns the ONNX session so inference
 * runs off the main thread.
 *
 * Protocol (parentPort messages):
 *   in:  { type: 'init', modelPath }                         -> out: { type: 'ready' } | { type: 'init_error', message }
 *   in:  { type: 'synthesize', id, segments: [{ ids, pauseSamples }] }
 *   out: { type: 'result', id, pcm: ArrayBuffer }  (16-bit mono PCM, transferred)
 *   out: { type: 'error', id, message }
 */
import { parentPort } from 'node:worker_threads';

interface SynthesizeSegment {
  ids: number[];
  pauseSamples: number;
}

let session: any = null;
let ort: any = null;

async function loadOrt(): Promise<any> {
  try {
    const mod: any = await import('onnxruntime-node');
    return mod.default || mod;
  } catch {
    const mod: any = await import('onnxruntime-web');
    const web = mod.default || mod;
    if (web?.env?.wasm) web.env.wasm.numThreads = 1;
    return web;
  }
}

export function float32ToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

async function synthesize(segments: SynthesizeSegment[]): Promise<ArrayBuffer> {
  const chunks: Int16Array[] = [];
  let total = 0;
  for (const seg of segments) {
    if (seg.ids.length > 0) {
      const feeds = {
        input: new ort.Tensor('int64', BigInt64Array.from(seg.ids, (v) => BigInt(v)), [1, seg.ids.length]),
        input_lengths: new ort.Tensor('int64', new BigInt64Array([BigInt(seg.ids.length)]), [1]),
        scales: new ort.Tensor('float32', new Float32Array([0.667, 1.0, 0.8]), [3]),
      };
      const result = await session.run(feeds);
      const data: Float32Array | undefined = result?.output?.data;
      if (data && data.length > 0) {
        const pcm = float32ToPcm16(data);
        chunks.push(pcm);
        total += pcm.length;
      }
    }
    if (seg.pauseSamples > 0) {
      chunks.push(new Int16Array(seg.pauseSamples));
      total += seg.pauseSamples;
    }
  }
  const combined = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return combined.buffer;
}

parentPort?.on('message', async (msg: any) => {
  if (msg?.type === 'init') {
    try {
      ort = await loadOrt();
      // One intra-op thread: the VPS has 2 vCPUs and the main thread needs the other one.
      session = await ort.InferenceSession.create(msg.modelPath, {
        intraOpNumThreads: 1,
        interOpNumThreads: 1,
      });
      parentPort!.postMessage({ type: 'ready' });
    } catch (err: any) {
      parentPort!.postMessage({ type: 'init_error', message: err?.message || String(err) });
    }
    return;
  }

  if (msg?.type === 'synthesize') {
    try {
      if (!session) throw new Error('Piper session not initialized');
      const pcm = await synthesize(msg.segments || []);
      parentPort!.postMessage({ type: 'result', id: msg.id, pcm }, [pcm]);
    } catch (err: any) {
      parentPort!.postMessage({ type: 'error', id: msg.id, message: err?.message || String(err) });
    }
  }
});
