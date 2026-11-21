/**
 * Maya Voice Synthesis (Backend Piper Neural TTS Engine)
 *
 * Uses the self-hosted Piper TTS running on the NestJS backend, so every platform hears
 * the same voice (no browser speech synthesis).
 *
 * - Text is split into sentences; each sentence is its own clip, so the first one plays
 *   while the next is still being generated, with a natural pause at each full stop.
 * - Clips come as WebM/Opus (~10x smaller than WAV) when the browser can play it, WAV
 *   otherwise (iOS Safari < 17.4).
 * - In-memory blob URL cache for instant replays; concurrent requests are shared.
 */

import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { splitSpeechSentences, pauseAfterSentenceMs } from '@/utils/speech-sentences';

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
};

let activeAudioElement: HTMLAudioElement | null = null;
let activeOnEndCallback: (() => void) | null = null;
let activePauseTimer: ReturnType<typeof setTimeout> | null = null;
let currentSpeechRequestId = 0;
const audioBlobCache = new Map<string, string>();
const inFlightVoice = new Map<string, Promise<string>>();

/**
 * Kept as a no-op for compatibility with onboarding screen pre-warming hooks.
 */
export function warmUpSpeechVoices(): void {}

export function getBestCallirrhoeVoice(): null {
  return null;
}

let cachedFormat: 'webm' | 'wav' | null = null;

/** WebM/Opus when this browser can play it, else WAV. */
function preferredAudioFormat(): 'webm' | 'wav' {
  if (cachedFormat) return cachedFormat;
  let format: 'webm' | 'wav' = 'wav';
  try {
    if (typeof document !== 'undefined') {
      const probe = document.createElement('audio');
      if (probe.canPlayType?.('audio/webm; codecs="opus"')) format = 'webm';
    }
  } catch {
    /* keep WAV */
  }
  cachedFormat = format;
  return format;
}

/**
 * Fetches (or reuses) the backend Piper clip for one sentence and returns a blob: URL.
 * Concurrent callers share one request, so a prefetch started on the analyzing screen is
 * picked up by the feedback screen. Never aborted: a stopped clip is still cached.
 */
function fetchMayaVoiceUrl(text: string): Promise<string> {
  const cached = audioBlobCache.get(text);
  if (cached) return Promise.resolve(cached);
  const pending = inFlightVoice.get(text);
  if (pending) return pending;

  const task = (async () => {
    const res = await fetch(`${getBackendBaseUrl()}/v1/sessions/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'Amy', format: preferredAudioFormat() }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.audioBase64) throw new Error('Empty audioBase64 from backend');

    const byteCharacters = atob(data.audioBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blobUrl = URL.createObjectURL(new Blob([byteArray], { type: data.mimeType || 'audio/wav' }));
    audioBlobCache.set(text, blobUrl);
    return blobUrl;
  })().finally(() => {
    inFlightVoice.delete(text);
  });

  inFlightVoice.set(text, task);
  return task;
}

function detachActiveAudio() {
  if (!activeAudioElement) return;
  try {
    activeAudioElement.onplay = null;
    activeAudioElement.onended = null;
    activeAudioElement.onerror = null;
    activeAudioElement.pause();
    activeAudioElement.currentTime = 0;
  } catch {}
  activeAudioElement = null;
}

/** Plays one clip; resolves when it ends, rejects on a playback error. */
function playClip(blobUrl: string, requestId: number, rate: number | undefined, onPlay?: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (requestId !== currentSpeechRequestId) return resolve();
    detachActiveAudio();
    const audio = new Audio(blobUrl);
    activeAudioElement = audio;
    if (rate && rate > 0) audio.playbackRate = rate;
    audio.onplay = () => {
      if (requestId !== currentSpeechRequestId) {
        try {
          audio.pause();
        } catch {}
        return resolve();
      }
      onPlay?.();
    };
    audio.onended = () => {
      if (activeAudioElement === audio) activeAudioElement = null;
      resolve();
    };
    audio.onerror = (e) => {
      if (activeAudioElement === audio) activeAudioElement = null;
      reject(e);
    };
    const p = audio.play();
    if (p !== undefined) {
      p.catch((err) => {
        if (activeAudioElement === audio) activeAudioElement = null;
        reject(err);
      });
    }
  });
}

function wait(ms: number, requestId: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || requestId !== currentSpeechRequestId) return resolve();
    activePauseTimer = setTimeout(() => {
      activePauseTimer = null;
      resolve();
    }, ms);
  });
}

/**
 * Main entrance: speaks `text` with the backend Piper voice, sentence by sentence.
 * onStart fires when the first sentence starts, onEnd after the last one (or when stopped).
 */
export function speakAsCallirrhoe(text: string, options?: SpeakOptions): boolean {
  // Cancel any previous playback first
  stopMayaVoiceFallback();

  const sentences = splitSpeechSentences(text);
  if (sentences.length === 0) {
    options?.onEnd?.();
    return true;
  }
  if (typeof window === 'undefined') return false;

  const requestId = ++currentSpeechRequestId;
  const onEnd = options?.onEnd;
  activeOnEndCallback = onEnd || null;

  // Request every sentence now, in order: the server generates them in arrival order,
  // so sentence 2 is being made while sentence 1 plays.
  const urls = sentences.map((s) => fetchMayaVoiceUrl(s));
  urls.forEach((u) => u.catch(() => undefined));

  void (async () => {
    let started = false;
    try {
      for (let i = 0; i < sentences.length; i++) {
        const url = await urls[i];
        if (requestId !== currentSpeechRequestId) return;
        await playClip(url, requestId, options?.rate, () => {
          if (!started) {
            started = true;
            options?.onStart?.();
          }
        });
        if (requestId !== currentSpeechRequestId) return;
        if (i < sentences.length - 1) await wait(pauseAfterSentenceMs(sentences[i]), requestId);
      }
      if (requestId !== currentSpeechRequestId) return;
      if (activeOnEndCallback === onEnd) activeOnEndCallback = null;
      onEnd?.();
    } catch (err) {
      if (requestId !== currentSpeechRequestId) return;
      if (activeOnEndCallback === onEnd) activeOnEndCallback = null;
      console.warn('[MayaVoice] Backend TTS playback failed:', err);
      options?.onError?.(err);
    }
  })();

  return true;
}

/** True when `text` can play immediately (every sentence already downloaded). */
export function isMayaVoiceCached(text: string): boolean {
  const sentences = splitSpeechSentences(text);
  return sentences.length > 0 && sentences.every((s) => audioBlobCache.has(s));
}

/**
 * Downloads clips ahead of time so they play instantly later. Sentences are requested in
 * play order, at most two at a time, so the server (which generates one clip at a time)
 * finishes the first one first instead of being flooded. Resolves when all are cached or
 * `timeoutMs` elapses (never rejects); requests keep running after a timeout.
 */
export function prefetchMayaVoice(texts: string[], timeoutMs = 20000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const queue = [...new Set(texts.flatMap((t) => splitSpeechSentences(t)))].filter((s) => !audioBlobCache.has(s));
  if (queue.length === 0) return Promise.resolve();
  let next = 0;
  const lane = async () => {
    while (next < queue.length) {
      const s = queue[next++];
      await fetchMayaVoiceUrl(s).catch(() => undefined);
    }
  };
  const all = Promise.all([lane(), lane()]).then(() => undefined);
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export function stopMayaVoiceFallback(): void {
  currentSpeechRequestId++;

  if (activePauseTimer) {
    clearTimeout(activePauseTimer);
    activePauseTimer = null;
  }
  detachActiveAudio();

  if (activeOnEndCallback) {
    const cb = activeOnEndCallback;
    activeOnEndCallback = null;
    try {
      cb();
    } catch {}
  }
}
