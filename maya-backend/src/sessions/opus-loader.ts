import { createRequire } from 'node:module';
import type { OpusEncoderFactory, OpusDecoderLike } from './webm-opus.js';

/**
 * Loads the native @discordjs/opus encoder (MIT) for recording encoding. Returns undefined
 * when the native module is unavailable, so callers fall back to WAV.
 */
export function loadOpusEncoderFactory(): OpusEncoderFactory | undefined {
  try {
    const req = createRequire(import.meta.url);
    const mod = req('@discordjs/opus');
    const OpusEncoder = mod.OpusEncoder || mod.default?.OpusEncoder;
    if (!OpusEncoder) return undefined;
    return (sampleRate: number) => new OpusEncoder(sampleRate, 1);
  } catch {
    return undefined;
  }
}

/** Same native module used as a decoder (OpusEncoder.decode). */
export function loadOpusDecoderFactory(): ((sampleRate: number) => OpusDecoderLike) | undefined {
  try {
    const req = createRequire(import.meta.url);
    const mod = req('@discordjs/opus');
    const OpusEncoder = mod.OpusEncoder || mod.default?.OpusEncoder;
    if (!OpusEncoder) return undefined;
    return (sampleRate: number) => new OpusEncoder(sampleRate, 1);
  } catch {
    return undefined;
  }
}
