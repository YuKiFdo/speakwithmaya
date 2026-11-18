import { Platform } from 'react-native';
import { getBackendBaseUrl } from '@/utils/backend-url';

/**
 * Session recordings are stored as WebM/Opus (legacy sessions: WAV). WebM/Opus plays in
 * Chrome, Firefox, Android and Safari on iOS 17.4+, but not in older iOS Safari or the
 * native iOS player (AVPlayer). On those, recording URLs are rewritten to the backend's
 * recording-audio endpoint with format=wav, which serves a WAV conversion.
 */
let webmSupport: boolean | null = null;

export function canPlayWebmOpus(): boolean {
  if (webmSupport !== null) return webmSupport;
  if (Platform.OS === 'ios') {
    webmSupport = false; // AVPlayer cannot play WebM
  } else if (Platform.OS === 'android') {
    webmSupport = true; // ExoPlayer plays WebM/Opus
  } else {
    try {
      const probe = typeof Audio !== 'undefined' ? new Audio() : null;
      webmSupport = !!probe && probe.canPlayType('audio/webm; codecs="opus"') !== '';
    } catch {
      webmSupport = false;
    }
  }
  return webmSupport;
}

// <bucket>/<sessionId>/full_conversation.webm  |  <bucket>/<sessionId>/turns/<speaker>_turn_<n>.webm
const STORED_WEBM = /\/([0-9a-f-]{36})\/(?:(full_conversation)|turns\/(user|model)_turn_(\d+))\.webm(?:\?|$)/i;

/** Returns a URL this device can play for a session recording URL (unchanged if playable). */
export function playableRecordingUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (canPlayWebmOpus()) return url;

  if (url.includes('/recording-audio?')) {
    return url.includes('format=wav') ? url : `${url}&format=wav`;
  }
  const m = STORED_WEBM.exec(url);
  if (!m) return url; // legacy .wav or something else: already playable
  const [, sessionId, full, speaker, index] = m;
  const q = full ? 'type=full' : `type=turn&speaker=${speaker}&index=${index}`;
  return `${getBackendBaseUrl()}/v1/sessions/${sessionId}/recording-audio?${q}&format=wav`;
}
