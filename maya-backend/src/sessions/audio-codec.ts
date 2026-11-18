/**
 * Pure PCM helpers with no dependencies (safe to import from worker threads).
 */

export function encodePcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 16000,
  numChannels: number = 1,
  bitDepth: number = 16,
): Buffer {
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmBuffer.copy(buffer, 44);
  return buffer;
}

export function resamplePcm16Mono(inputBuffer: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate || inputBuffer.length === 0) return inputBuffer;
  const numInputSamples = Math.floor(inputBuffer.length / 2);
  if (numInputSamples === 0) return Buffer.alloc(0);
  // Typed-array views are several times faster than per-sample readInt16LE/writeInt16LE.
  const src = inputBuffer.byteOffset % 2 === 0
    ? new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, numInputSamples)
    : new Int16Array(Uint8Array.from(inputBuffer.subarray(0, numInputSamples * 2)).buffer);
  const ratio = toRate / fromRate;
  const numOutputSamples = Math.floor(numInputSamples * ratio);
  const out = new Int16Array(numOutputSamples);
  const last = numInputSamples - 1;
  for (let i = 0; i < numOutputSamples; i++) {
    const srcIndex = i / ratio;
    const f = Math.floor(srcIndex);
    const c = f + 1 > last ? last : f + 1;
    const w = srcIndex - f;
    const v = Math.round(src[f] * (1 - w) + src[c] * w);
    out[i] = v < -32768 ? -32768 : v > 32767 ? 32767 : v;
  }
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

/** Raw session audio handed to the finalize step. */
export interface SessionAudioInput {
  userPcm?: Buffer; // 16 kHz
  modelPcm?: Buffer; // 24 kHz
  userTurns?: Array<[number, Buffer]>; // 16 kHz per turn
  modelTurns?: Array<[number, Buffer]>; // 24 kHz per turn
  chronologicalTurns?: Array<{ pcm: Buffer; sampleRate: number }>;
}

/** Encoded files ready to upload (content type in `mime`). */
export interface SessionAudioFiles {
  mime: string;
  ext: string;
  user?: Buffer;
  model?: Buffer;
  full?: Buffer;
  userTurns: Array<[number, Buffer]>;
  modelTurns: Array<[number, Buffer]>;
}

const FULL_CONVERSATION_GAP = Buffer.alloc(16800); // 350 ms of 24 kHz silence between turns

/**
 * Builds every recording file for a session: CPU-heavy (concat, resample, encode), so it
 * runs in the audio-finalize worker; also used inline as a fallback.
 */
export function buildSessionAudioFiles(input: SessionAudioInput): SessionAudioFiles {
  const out: SessionAudioFiles = { mime: 'audio/wav', ext: 'wav', userTurns: [], modelTurns: [] };
  if (input.userPcm?.length) out.user = encodePcmToWav(input.userPcm, 16000);
  if (input.modelPcm?.length) out.model = encodePcmToWav(input.modelPcm, 24000);

  const segments: Buffer[] = [];
  for (const t of input.chronologicalTurns || []) {
    if (!t.pcm?.length) continue;
    segments.push(t.sampleRate === 24000 ? t.pcm : resamplePcm16Mono(t.pcm, t.sampleRate, 24000));
    segments.push(FULL_CONVERSATION_GAP);
  }
  if (segments.length) out.full = encodePcmToWav(Buffer.concat(segments), 24000);

  for (const [idx, pcm] of input.userTurns || []) if (pcm?.length) out.userTurns.push([idx, encodePcmToWav(pcm, 16000)]);
  for (const [idx, pcm] of input.modelTurns || []) if (pcm?.length) out.modelTurns.push([idx, encodePcmToWav(pcm, 24000)]);
  return out;
}

/** Where each part of the session input sits inside the packed ArrayBuffer. */
export interface PackedLayout {
  user?: [number, number];
  model?: [number, number];
  userTurns: Array<[number, number, number]>; // [turnIdx, offset, length]
  modelTurns: Array<[number, number, number]>;
  chrono: Array<[number, number, number]>; // [sampleRate, offset, length]
}

const COPY_SLICE_BYTES = 4 * 1024 * 1024; // yield to the event loop after every ~4 MiB copied

export async function packSessionAudio(input: SessionAudioInput): Promise<{ packed: ArrayBuffer; layout: PackedLayout }> {
  const parts: Buffer[] = [];
  let total = 0;
  const add = (b: Buffer): [number, number] => {
    const at = total;
    parts.push(b);
    total += b.length;
    return [at, b.length];
  };
  const layout: PackedLayout = { userTurns: [], modelTurns: [], chrono: [] };
  if (input.userPcm?.length) layout.user = add(input.userPcm);
  if (input.modelPcm?.length) layout.model = add(input.modelPcm);
  for (const [idx, b] of input.userTurns || []) if (b?.length) layout.userTurns.push([idx, ...add(b)]);
  for (const [idx, b] of input.modelTurns || []) if (b?.length) layout.modelTurns.push([idx, ...add(b)]);
  for (const t of input.chronologicalTurns || []) if (t.pcm?.length) layout.chrono.push([t.sampleRate, ...add(t.pcm)]);

  const packed = new ArrayBuffer(total);
  const dst = new Uint8Array(packed);
  let pos = 0;
  let sinceYield = 0;
  for (const b of parts) {
    for (let off = 0; off < b.length; off += COPY_SLICE_BYTES) {
      const end = Math.min(b.length, off + COPY_SLICE_BYTES);
      dst.set(b.subarray(off, end), pos);
      pos += end - off;
      sinceYield += end - off;
      if (sinceYield >= COPY_SLICE_BYTES) {
        sinceYield = 0;
        await new Promise((r) => setImmediate(r));
      }
    }
  }
  return { packed, layout };
}

/** Inverse of packSessionAudio (used inside the worker): zero-copy views into `packed`. */
export function unpackSessionAudio(packed: ArrayBuffer, layout: PackedLayout): SessionAudioInput {
  const view = (at: number, len: number) => Buffer.from(packed, at, len);
  return {
    userPcm: layout.user ? view(...layout.user) : undefined,
    modelPcm: layout.model ? view(...layout.model) : undefined,
    userTurns: layout.userTurns.map(([idx, at, len]) => [idx, view(at, len)]),
    modelTurns: layout.modelTurns.map(([idx, at, len]) => [idx, view(at, len)]),
    chronologicalTurns: layout.chrono.map(([sampleRate, at, len]) => ({ sampleRate, pcm: view(at, len) })),
  };
}
