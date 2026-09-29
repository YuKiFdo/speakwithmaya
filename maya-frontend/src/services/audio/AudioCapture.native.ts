import {
  AudioModule,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { IAudioCapture, AudioCaptureCallbacks } from './AudioCapture';

export class NativeAudioCapture implements IAudioCapture {
  private stream: any = null;
  private bufferSub: any = null;
  private statusSub: any = null;
  private isRec: boolean = false;
  private callbacks: AudioCaptureCallbacks | null = null;

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.isRec) return;
    this.callbacks = callbacks;

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
      this.bufferSub = stream.addListener('audioStreamBuffer', (event: any) => {
        if (!this.isRec) return;
        const pcmData = event?.data as ArrayBuffer;
        if (!pcmData || pcmData.byteLength === 0) return;

        nativeChunkCount++;

        // CRITICAL: Copy the NativeArrayBuffer into a regular JS ArrayBuffer immediately.
        // The native JSI buffer (NativeArrayBuffer) may be recycled/invalidated after this
        // listener returns. If we pass the original reference to sendAudioChunk(), the data
        // will be empty or garbage by the time it's base64-encoded and sent over WebSocket.
        const copy = new ArrayBuffer(pcmData.byteLength);
        new Uint8Array(copy).set(new Uint8Array(pcmData));

        // 1. Calculate real-time RMS voice volume for speech-reactive glow
        try {
          const int16 = new Int16Array(copy);
          let sumSquares = 0;
          for (let i = 0; i < int16.length; i++) {
            const norm = int16[i] / 32768.0;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / int16.length);
          // Noise floor ~0.008. Map conversational speech smoothly to [0, 1]
          const volume = rms < 0.008 ? 0 : Math.min(1, Math.max(0, (rms - 0.008) * 8.0));
          this.callbacks?.onVolumeChange?.(volume);

          if (nativeChunkCount <= 3 || nativeChunkCount % 50 === 0) {
            console.log(`[NativeAudioCapture] Mic captured buffer #${nativeChunkCount}: ${copy.byteLength} bytes, RMS=${rms.toFixed(4)}, vol=${volume.toFixed(2)}`);
          }
        } catch {}

        // 2. Stream raw 16kHz PCM audio chunk directly to Gemini Live
        this.callbacks?.onAudioData(copy);
      });

      this.statusSub = stream.addListener('audioStreamStatus', (status: any) => {
        if (status && typeof status.isStreaming === 'boolean') {
          this.isRec = status.isStreaming;
        }
      });

      await stream.start();
      this.stream = stream;
      this.isRec = true;

      // On iOS, ensure session remains in playAndRecord with speaker routing
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });

      console.log('[NativeAudioCapture] Real-time 16kHz PCM microphone stream active');
    } catch (err: any) {
      console.error('[NativeAudioCapture] Failed to start native recording stream:', err);
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

    this.callbacks?.onVolumeChange?.(0);
    this.callbacks = null;
  }

  isRecording(): boolean {
    return this.isRec;
  }
}

export const createAudioCapture = (): IAudioCapture => new NativeAudioCapture();
