import { IAudioCapture, AudioCaptureCallbacks } from './AudioCapture';
import { getLogTimestamp } from '@/utils/time';

export class WebAudioCapture implements IAudioCapture {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private recording: boolean = false;
  private callbacks: AudioCaptureCallbacks | null = null;

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.recording) return;
    this.callbacks = callbacks;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error('Microphone access requires a secure HTTPS connection. Please load this page over HTTPS.');
      }
      throw new Error('Microphone access is not supported in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      await this.audioCtx.audioWorklet.addModule('/audio-processor.js');

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-downsampler-processor');
      let chunkCount = 0;
      let noiseFloor = 0.010;
      let isSpeaking = false;
      let hangoverRemaining = 0;
      const preRollBuffer: ArrayBuffer[] = [];
      const HANGOVER_CHUNKS = 8; // ~800ms natural conversational pause window

      this.workletNode.port.onmessage = (event) => {
        if (!this.recording) return;
        const chunk = event.data as ArrayBuffer;
        if (chunk && chunk.byteLength > 0) {
          chunkCount++;

          // Calculate RMS voice strength for real-time visual feedback
          const int16 = new Int16Array(chunk);
          let sumSquares = 0;
          for (let i = 0; i < int16.length; i++) {
            const norm = int16[i] / 32768.0;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / int16.length);

          // Update adaptive noise floor during silence
          if (rms < 0.016) {
            noiseFloor = noiseFloor * 0.95 + rms * 0.05;
          }

          // Check if speaker is outputting AI audio or room echo is decaying
          if (this.callbacks?.isOutputPlaying?.()) {
            if (isSpeaking) {
              isSpeaking = false;
              hangoverRemaining = 0;
              preRollBuffer.length = 0;
            }
            this.callbacks?.onVolumeChange?.(0);
            return;
          }

          // Scale RMS so conversational voice maps from 0.0 to 1.0 (noise gate < noiseFloor)
          const volume = rms < noiseFloor ? 0 : Math.min(1, Math.max(0, (rms - noiseFloor) * 7.5));
          this.callbacks?.onVolumeChange?.(volume);

          // Client-Side VAD & Silence Gate
          const speechThreshold = Math.max(0.020, noiseFloor * 1.85);

          if (rms >= speechThreshold) {
            if (!isSpeaking) {
              isSpeaking = true;
              console.log(`[${getLogTimestamp()}] 🎤 [User Speaking] Started (RMS=${rms.toFixed(3)})`);
              this.callbacks?.onVoiceStart?.();

              while (preRollBuffer.length > 0) {
                const preChunk = preRollBuffer.shift();
                if (preChunk) this.callbacks?.onAudioData(preChunk);
              }
            }

            hangoverRemaining = HANGOVER_CHUNKS;
            this.callbacks?.onAudioData(chunk);
          } else if (hangoverRemaining > 0) {
            hangoverRemaining--;
            this.callbacks?.onAudioData(chunk);
          } else {
            if (isSpeaking) {
              isSpeaking = false;
              console.log(`[${getLogTimestamp()}] 🛑 [User Silent] Speech turn ended (RMS=${rms.toFixed(3)})`);
              this.callbacks?.onVoiceEnd?.();
            }

            if (preRollBuffer.length >= 2) {
              preRollBuffer.shift();
            }
            preRollBuffer.push(chunk);
          }
        }
      };

      this.sourceNode.connect(this.workletNode);
      this.recording = true;
    } catch (err: any) {
      this.stop();
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.recording = false;

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }

    this.callbacks = null;
  }

  isRecording(): boolean {
    return this.recording;
  }
}

export const createAudioCapture = (): IAudioCapture => new WebAudioCapture();
