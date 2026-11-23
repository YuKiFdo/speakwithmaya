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

describe('AudioFinalizeClient job queue', () => {
  /** Replaces the real build with one the test finishes by hand, recording the start order. */
  function controlledClient() {
    const c = new AudioFinalizeClient(new URL('file:///nonexistent/audio-finalize.worker.js'));
    const started: string[] = [];
    const finish = new Map<string, () => void>();
    (c as any).buildNow = (input: any) =>
      new Promise((resolve) => {
        const name = input.name as string;
        started.push(name);
        finish.set(name, () => resolve({ mime: 'audio/wav', ext: 'wav', userTurns: [], modelTurns: [] }));
      });
    return { c, started, finish };
  }
  const tick = () => new Promise((r) => setImmediate(r));

  it('runs one job at a time, so calls ending together do not all pack their audio at once', async () => {
    const { c, started, finish } = controlledClient();
    const jobs = ['a', 'b', 'c'].map((name) => c.build({ name } as any, { priority: 'low' }));
    await tick();
    expect(started).toEqual(['a']);
    expect(c.queuedJobs).toBe(2);
    finish.get('a')!();
    await tick();
    expect(started).toEqual(['a', 'b']);
    finish.get('b')!();
    await tick();
    finish.get('c')!();
    await Promise.all(jobs);
    expect(started).toEqual(['a', 'b', 'c']);
    expect(c.queuedJobs).toBe(0);
  });

  it('lets turn clips (high) go ahead of queued full-conversation builds (low)', async () => {
    const { c, started, finish } = controlledClient();
    const jobs = [
      c.build({ name: 'full-1' } as any, { priority: 'low' }),
      c.build({ name: 'full-2' } as any, { priority: 'low' }),
      c.build({ name: 'turn' } as any),
    ];
    await tick();
    finish.get('full-1')!();
    await tick();
    expect(started).toEqual(['full-1', 'turn']);
    finish.get('turn')!();
    await tick();
    finish.get('full-2')!();
    await Promise.all(jobs);
    expect(started).toEqual(['full-1', 'turn', 'full-2']);
  });

  it('frees the slot when a job fails', async () => {
    const c = new AudioFinalizeClient(new URL('file:///nonexistent/audio-finalize.worker.js'));
    let calls = 0;
    (c as any).buildNow = async () => {
      if (calls++ === 0) throw new Error('boom');
      return { mime: 'audio/wav', ext: 'wav', userTurns: [], modelTurns: [] };
    };
    await expect(c.build({ userTurns: [] })).rejects.toThrow('boom');
    await expect(c.build({ userTurns: [] })).resolves.toMatchObject({ ext: 'wav' });
  });
});
