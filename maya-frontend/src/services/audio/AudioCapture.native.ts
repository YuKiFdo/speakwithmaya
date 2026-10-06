import {
  AudioModule,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { IAudioCapture, AudioCaptureCallbacks } from './AudioCapture';
import { getLogTimestamp } from '@/utils/time';

// Global singleton tracking to prevent duplicate concurrent audio streams across fast-refresh/reconnects
let activeGlobalStream: any = null;
let activeGlobalBufferSub: any = null;
let activeGlobalStatusSub: any = null;

export class NativeAudioCapture implements IAudioCapture {
  private stream: any = null;
  private bufferSub: any = null;
  private statusSub: any = null;
  private isRec: boolean = false;
  private callbacks: AudioCaptureCallbacks | null = null;

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.isRec) return;
    this.callbacks = callbacks;

    // Aggressively clean up any lingering native stream across the process
    if (activeGlobalBufferSub) {
      try { activeGlobalBufferSub.remove(); } catch {}
      activeGlobalBufferSub = null;
    }
    if (activeGlobalStatusSub) {
      try { activeGlobalStatusSub.remove(); } catch {}
      activeGlobalStatusSub = null;
    }
    if (activeGlobalStream) {
      try { activeGlobalStream.stop(); } catch {}
      activeGlobalStream = null;
    }

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Microphone permission was not granted');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });

      // Native real-time PCM microphone streaming (16kHz, 16-bit mono)
      const stream = new AudioModule.AudioStream({
        sampleRate: 16000,
        channels: 1,
        encoding: 'int16',
      });

      let nativeChunkCount = 0;
      let noiseFloor = 0.010;
      let isSpeaking = false;
      let speechChunkCount = 0;
      let hangoverRemaining = 0;
      const preRollBuffer: ArrayBuffer[] = [];
      const HANGOVER_CHUNKS = 10; // ~1000ms conversational pause window before closing speech turn

      this.bufferSub = stream.addListener('audioStreamBuffer', (event: any) => {
        if (!this.isRec) return;
        const pcmData = event?.data as ArrayBuffer;
        if (!pcmData || pcmData.byteLength === 0) return;

        nativeChunkCount++;

        // CRITICAL: Copy the NativeArrayBuffer into a regular JS ArrayBuffer immediately.
        const copy = new ArrayBuffer(pcmData.byteLength);
        new Uint8Array(copy).set(new Uint8Array(pcmData));

        // 1. Calculate real-time RMS voice volume
        let rms = 0;
        try {
          const int16 = new Int16Array(copy);
          let sumSquares = 0;
          for (let i = 0; i < int16.length; i++) {
            const norm = int16[i] / 32768.0;
            sumSquares += norm * norm;
          }
          rms = Math.sqrt(sumSquares / int16.length);

          // Update adaptive noise floor during silence
          if (rms < 0.016) {
            noiseFloor = noiseFloor * 0.95 + rms * 0.05;
          }

          // Check if phone speaker is outputting AI audio or room echo is decaying
          if (this.callbacks?.isOutputPlaying?.()) {
            if (isSpeaking) {
              isSpeaking = false;
              speechChunkCount = 0;
              hangoverRemaining = 0;
              preRollBuffer.length = 0;
            }
            this.callbacks?.onVolumeChange?.(0);
            return;
          }

          // Map conversational speech smoothly to [0, 1] for UI glow
          const volume = rms < noiseFloor ? 0 : Math.min(1, Math.max(0, (rms - noiseFloor) * 7.5));
          this.callbacks?.onVolumeChange?.(volume);
        } catch {}

        // 2. Client-Side VAD (Voice Activity Detection) & Silence Gate
        const speechThreshold = Math.max(0.020, noiseFloor * 1.85);

        if (rms >= speechThreshold) {
          speechChunkCount++;
          // Voice activity detected
          if (!isSpeaking) {
            isSpeaking = true;
            console.log(`[${getLogTimestamp()}] 🎤 [User Speaking] Started (RMS=${rms.toFixed(3)})`);
            this.callbacks?.onVoiceStart?.();

            // Flush pre-roll buffer so initial consonants (e.g. "p", "t", "s") are not clipped
            while (preRollBuffer.length > 0) {
              const preChunk = preRollBuffer.shift();
              if (preChunk) this.callbacks?.onAudioData(preChunk);
            }
          }

          hangoverRemaining = HANGOVER_CHUNKS;
          this.callbacks?.onAudioData(copy);
        } else if (hangoverRemaining > 0) {
          // Voice tail / natural decay / micro-pause between words - send audio chunk
          hangoverRemaining--;
          this.callbacks?.onAudioData(copy);
        } else {
          // Silence: conclude speech turn if the user genuinely spoke
          if (isSpeaking) {
            isSpeaking = false;
            console.log(`[${getLogTimestamp()}] 🛑 [User Silent] Speech turn ended (${speechChunkCount} chunks, ~${speechChunkCount * 100}ms)`);
            if (speechChunkCount >= 3) {
              this.callbacks?.onVoiceEnd?.();
            }
            speechChunkCount = 0;
          }

          // Maintain a 2-chunk pre-roll queue (~200ms)
          if (preRollBuffer.length >= 2) {
            preRollBuffer.shift();
          }
          preRollBuffer.push(copy);
        }
      });

      this.statusSub = stream.addListener('audioStreamStatus', (status: any) => {
        if (status && typeof status.isStreaming === 'boolean') {
          this.isRec = status.isStreaming;
        }
      });

      await stream.start();
      this.stream = stream;
      this.isRec = true;

      // Track active global stream
      activeGlobalStream = stream;
      activeGlobalBufferSub = this.bufferSub;
      activeGlobalStatusSub = this.statusSub;

      // On iOS, ensure session remains in playAndRecord with speaker routing
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });

      console.log(`[${getLogTimestamp()}] [NativeAudioCapture] Real-time 16kHz PCM microphone stream with VAD active`);
    } catch (err: any) {
      console.error(`[${getLogTimestamp()}] [NativeAudioCapture] Failed to start native recording stream:`, err);
      this.stop();
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.isRec = false;

    if (this.bufferSub) {
      try {
        this.bufferSub.remove();
      } catch {}
      this.bufferSub = null;
    }

    if (this.statusSub) {
      try {
        this.statusSub.remove();
      } catch {}
      this.statusSub = null;
    }

    if (this.stream) {
      try {
        this.stream.stop();
      } catch {}
      this.stream = null;
    }

    if (activeGlobalStream === this.stream || activeGlobalStream) {
      try { activeGlobalStream.stop(); } catch {}
      activeGlobalStream = null;
    }
    activeGlobalBufferSub = null;
    activeGlobalStatusSub = null;

    this.callbacks?.onVolumeChange?.(0);
    this.callbacks = null;
  }

  isRecording(): boolean {
    return this.isRec;
  }

  setNetworkQuality(_quality: 'good' | 'fair' | 'poor'): void {
    // Native audio handles noise suppression via OS audio HAL
  }
}

export const createAudioCapture = (): IAudioCapture => new NativeAudioCapture();
