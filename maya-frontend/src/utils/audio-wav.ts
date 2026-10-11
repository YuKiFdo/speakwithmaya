/**
 * Utility to convert raw 16-bit PCM chunks to a playable WAV Blob URL
 */
export function createWavBlobUrlFromPcm(
  chunks: ArrayBuffer[],
  sampleRate: number = 16000,
  numChannels: number = 1
): string {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return '';
  try {
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.byteLength;
    }
    if (totalLength === 0) return '';

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    const writeString = (v: DataView, off: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(off + i, str.charCodeAt(i));
      }
    };

    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + combined.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // 16 bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, combined.length, true);

    const blob = new Blob([header, combined], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[audio-wav] Failed to create WAV blob URL:', err);
    return '';
  }
}
