import { describe, it, expect } from 'vitest';
import { buildSessionAudioFiles } from './audio-codec.js';
import { AudioFinalizeClient } from './audio-finalize-client.js';

const pcm = (samples: number, v = 1000) => {
  const b = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) b.writeInt16LE(v, i * 2);
  return b;
};

describe('buildSessionAudioFiles', () => {
  it('without an Opus encoder: full + per-turn WAVs (no whole-session tracks)', () => {
    const files = buildSessionAudioFiles({
      userPcm: pcm(16000), // 1s @16k
      modelPcm: pcm(24000), // 1s @24k
      userTurns: [[0, pcm(8000)]],
      modelTurns: [[0, pcm(12000)], [1, Buffer.alloc(0)]],
      chronologicalTurns: [
        { pcm: pcm(24000), sampleRate: 24000 },
        { pcm: pcm(16000), sampleRate: 16000 }, // resampled to 24k -> 24000 samples
      ],
    });
    expect(files.mime).toBe('audio/wav');
    expect((files as any).user).toBeUndefined();
    expect((files as any).model).toBeUndefined();
    expect(files.userTurns[0][1].readUInt32LE(24)).toBe(16000);
    expect(files.modelTurns[0][1].readUInt32LE(24)).toBe(24000);
    // full = (24000 + 16800/2 gap) + (24000 + 8400 gap) samples * 2 bytes + 44 header
    expect(files.full!.length).toBe(44 + (24000 + 8400) * 2 * 2);
    expect(files.userTurns.map(([i]) => i)).toEqual([0]);
    expect(files.modelTurns.map(([i]) => i)).toEqual([0]); // empty turn skipped
  });
});

describe('AudioFinalizeClient', () => {
  it('falls back to inline work when the compiled worker is not present', async () => {
    const c = new AudioFinalizeClient(new URL('file:///nonexistent/audio-finalize.worker.js'));
    expect(c.isAvailable()).toBe(false);
    const files = await c.build({ userTurns: [[0, pcm(1600)]] });
    expect(files.userTurns).toHaveLength(1); // WebM if the native Opus module loads, else WAV
  });
});
