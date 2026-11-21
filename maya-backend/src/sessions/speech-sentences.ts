/**
 * Splits narration into sentences, each requested and cached as its own clip, so the
 * first sentence plays while the next is still being synthesized.
 *
 * MUST stay identical to maya-frontend/src/utils/speech-sentences.ts: the server prewarms
 * exactly the clips the app will request, and a different split means cache misses.
 */
export function splitSpeechSentences(text: string): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[.!?]+$/.test(s));
}
