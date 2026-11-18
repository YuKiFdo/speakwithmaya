import { describe, it, expect } from 'vitest';
import { encodePcmToWebmOpus, demuxWebmOpus, decodeWebmOpusToPcm, OPUS_FRAME_MS } from './webm-opus.js';
import { loadOpusEncoderFactory, loadOpusDecoderFactory } from './opus-loader.js';
import { buildSessionAudioFiles, encodePcmToWav } from './audio-codec.js';

const createEncoder = loadOpusEncoderFactory();
const createDecoder = loadOpusDecoderFactory();

function tone(seconds: number, rate: number): Buffer {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = 0.5 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
    b.writeInt16LE(Math.round(v * 20000), i * 2);
  }
  return b;
}

function rms(pcm: Buffer, from = 0, to = pcm.length / 2): number {
  let s = 0;
  for (let i = from; i < to; i++) s += pcm.readInt16LE(i * 2) ** 2;
  return Math.sqrt(s / Math.max(1, to - from));
}

describe.runIf(!!createEncoder && !!createDecoder)('WebM/Opus recordings', () => {
  it.each([16000, 24000])('round-trips %i Hz speech-like audio and is far smaller than WAV', (rate) => {
    const pcm = tone(3, rate);
    const webm = encodePcmToWebmOpus(pcm, rate, createEncoder!);

    // EBML magic + "webm" doctype + Opus codec
    expect(webm.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
    expect(webm.includes(Buffer.from('webm'))).toBe(true);
    expect(webm.includes(Buffer.from('A_OPUS'))).toBe(true);
    expect(webm.includes(Buffer.from('OpusHead'))).toBe(true);

    const wavSize = encodePcmToWav(pcm, rate).length;
    expect(webm.length).toBeLessThan(wavSize / 6);

    const { packets, inputSampleRate } = demuxWebmOpus(webm);
    expect(inputSampleRate).toBe(rate);
    expect(packets.length).toBe(Math.ceil((3000) / OPUS_FRAME_MS));

    const decoded = decodeWebmOpusToPcm(webm, createDecoder!);
    expect(decoded.sampleRate).toBe(rate);
    // length within one frame + pre-skip of the original
    expect(Math.abs(decoded.pcm.length - pcm.length)).toBeLessThan((rate * 0.03) * 2);
    // loudness preserved (lossy codec: within 20%)
    const a = rms(pcm, rate / 2, rate * 2.5);
    const b = rms(decoded.pcm, rate / 2, rate * 2.5);
    expect(Math.abs(a - b) / a).toBeLessThan(0.2);
  });

  it('session files are WebM, without the duplicate whole-session tracks', () => {
    const files = buildSessionAudioFiles(
      {
        userPcm: tone(2, 16000),
        modelPcm: tone(2, 24000),
        userTurns: [[0, tone(1, 16000)]],
        modelTurns: [[0, tone(1, 24000)]],
        chronologicalTurns: [{ pcm: tone(1, 24000), sampleRate: 24000 }, { pcm: tone(1, 16000), sampleRate: 16000 }],
      },
      createEncoder,
    );
    expect(files.mime).toBe('audio/webm');
    expect(files.ext).toBe('webm');
    expect(files.full).toBeDefined();
    expect((files as any).user).toBeUndefined();
    expect((files as any).model).toBeUndefined();
    expect(files.userTurns).toHaveLength(1);
    expect(files.modelTurns).toHaveLength(1);
  });
});

describe('WAV fallback', () => {
  it('without an Opus encoder, files are WAV so recordings are never lost', () => {
    const files = buildSessionAudioFiles({ userTurns: [[0, tone(0.5, 16000)]] });
    expect(files.ext).toBe('wav');
    expect(files.userTurns[0][1].subarray(0, 4).toString()).toBe('RIFF');
  });
});
