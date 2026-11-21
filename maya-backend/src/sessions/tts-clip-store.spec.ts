import { describe, it, expect } from 'vitest';
import { TtsClipStore, EMPTY_CLIP } from './tts-clip-store.js';
import { splitSpeechSentences } from './speech-sentences.js';
import { loadOpusEncoderFactory, loadOpusDecoderFactory } from './opus-loader.js';

function tone(samples: number): Buffer {
  const b = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), i * 2);
  return b;
}

describe('splitSpeechSentences', () => {
  it('splits on . ! ? followed by a space and keeps the punctuation', () => {
    expect(splitSpeechSentences('Great job! Let’s look. Ready? Go')).toEqual(['Great job!', 'Let’s look.', 'Ready?', 'Go']);
  });
  it('keeps colons and commas inside a sentence', () => {
    expect(splitSpeechSentences('A better way to say this is: I went, finally.')).toEqual([
      'A better way to say this is: I went, finally.',
    ]);
  });
  it('normalises whitespace and drops empty or punctuation-only parts', () => {
    expect(splitSpeechSentences('  One.   \n Two.  . ')).toEqual(['One.', 'Two.']);
    expect(splitSpeechSentences('')).toEqual([]);
  });
  it('does not split decimals or words without a following space', () => {
    expect(splitSpeechSentences('It costs 2.50 rupees.')).toEqual(['It costs 2.50 rupees.']);
  });
});

describe('TtsClipStore', () => {
  it('falls back to WAV without an Opus encoder', () => {
    const store = new TtsClipStore();
    const clip = store.encode(tone(2205), 22050);
    expect(clip.mime).toBe('audio/wav');
    expect(clip.data.subarray(0, 4).toString()).toBe('RIFF');
    expect(clip.data.readUInt32LE(24)).toBe(22050);
    expect(store.toClip(clip, 'webm')).toEqual({ audioBase64: clip.data.toString('base64'), mimeType: 'audio/wav' });
  });

  it('uses a fake encoder for WebM, resampling 22.05 kHz to 24 kHz', () => {
    const rates: number[] = [];
    const store = new TtsClipStore((rate) => {
      rates.push(rate);
      return { encode: () => Buffer.from([1, 2, 3]) };
    });
    expect(store.encode(tone(2205), 22050).mime).toBe('audio/webm');
    expect(rates).toEqual([24000]);
    store.encode(tone(1600), 16000);
    expect(rates).toEqual([24000, 16000]);
  });

  it('falls back to WAV when the encoder throws', () => {
    const store = new TtsClipStore(() => ({
      encode: () => {
        throw new Error('boom');
      },
    }));
    expect(store.encode(tone(100), 16000).mime).toBe('audio/wav');
  });

  it('cannot serve WAV from WebM without a decoder', () => {
    const store = new TtsClipStore();
    expect(store.toClip({ data: Buffer.from([1]), mime: 'audio/webm' }, 'wav')).toEqual(EMPTY_CLIP);
  });

  const enc = loadOpusEncoderFactory();
  const dec = loadOpusDecoderFactory();
  it.runIf(!!enc && !!dec)('real Opus: WebM is much smaller than WAV and converts back to WAV', () => {
    const store = new TtsClipStore(enc, dec);
    const pcm = tone(22050 * 2); // 2 s
    const clip = store.encode(pcm, 22050);
    expect(clip.mime).toBe('audio/webm');
    expect(clip.data.length).toBeLessThan(pcm.length / 5);
    const wav = store.toClip(clip, 'wav');
    expect(wav.mimeType).toBe('audio/wav');
    expect(Buffer.from(wav.audioBase64, 'base64').subarray(0, 4).toString()).toBe('RIFF');
    expect(store.toClip(clip, 'webm').mimeType).toBe('audio/webm');
  });
});
