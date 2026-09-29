import { IAudioCapture, AudioCaptureCallbacks } from './AudioCapture';

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
      this.workletNode.port.onmessage = (event) => {
        if (!this.recording) return;
        const chunk = event.data as ArrayBuffer;
        if (chunk && chunk.byteLength > 0) {
          chunkCount++;
          this.callbacks?.onAudioData(chunk);

          // Calculate RMS voice strength for real-time visual feedback
          const int16 = new Int16Array(chunk);
          let sumSquares = 0;
          for (let i = 0; i < int16.length; i++) {
            const norm = int16[i] / 32768.0;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / int16.length);
          // Scale RMS so conversational voice maps from 0.0 to 1.0 (noise gate < 0.01)
          const volume = rms < 0.012 ? 0 : Math.min(1, Math.max(0, (rms - 0.012) * 8.0));
          this.callbacks?.onVolumeChange?.(volume);

          if (chunkCount <= 3 || chunkCount % 50 === 0) {
            console.log(`[WebAudioCapture] Mic captured chunk #${chunkCount}: ${chunk.byteLength} bytes, RMS=${rms.toFixed(4)}, vol=${volume.toFixed(2)}`);
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
