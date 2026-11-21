import { encodePcmToWav, resamplePcm16Mono } from './audio-codec.js';
import { decodeWebmOpusToPcm, encodePcmToWebmOpus, type OpusDecoderLike, type OpusEncoderFactory } from './webm-opus.js';

/** What the client can play: WebM/Opus (~10x smaller) or WAV (iOS Safari < 17.4). */
export type TtsFormat = 'webm' | 'wav';

export interface TtsClip {
  audioBase64: string;
  mimeType: string;
}

/** One synthesized clip in its cached form (WebM/Opus when an encoder is available, else WAV). */
export interface StoredClip {
  data: Buffer;
  mime: 'audio/webm' | 'audio/wav';
}

const OPUS_RATES = [8000, 12000, 16000, 24000, 48000];

export const EMPTY_CLIP: TtsClip = { audioBase64: '', mimeType: 'audio/wav' };

/** Encodes Piper output for the in-memory cache and converts it to what the client plays. */
export class TtsClipStore {
  constructor(
    private readonly createEncoder?: OpusEncoderFactory,
    private readonly createDecoder?: (sampleRate: number) => OpusDecoderLike,
  ) {}

  /** Encodes 16-bit mono PCM: WebM/Opus when possible, WAV otherwise. */
  encode(pcm: Buffer, sampleRate: number): StoredClip {
    if (this.createEncoder) {
      try {
        const rate = OPUS_RATES.includes(sampleRate) ? sampleRate : 24000;
        const input = rate === sampleRate ? pcm : resamplePcm16Mono(pcm, sampleRate, rate);
        return { data: encodePcmToWebmOpus(input, rate, this.createEncoder), mime: 'audio/webm' };
      } catch {
        /* fall through to WAV */
      }
    }
    return { data: encodePcmToWav(pcm, sampleRate), mime: 'audio/wav' };
  }

  /** Converts a cached clip into what the client asked for. */
  toClip(clip: StoredClip, format: TtsFormat): TtsClip {
    if (clip.mime === 'audio/webm' && format === 'wav') {
      if (!this.createDecoder) return EMPTY_CLIP;
      const { pcm, sampleRate } = decodeWebmOpusToPcm(clip.data, this.createDecoder);
      return { audioBase64: encodePcmToWav(pcm, sampleRate).toString('base64'), mimeType: 'audio/wav' };
    }
    return { audioBase64: clip.data.toString('base64'), mimeType: clip.mime };
  }
}
