import { IAudioPlayer, AudioPlayerCallbacks } from './AudioPlayer';

export class WebAudioPlayer implements IAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private playerNode: AudioWorkletNode | null = null;
  private callbacks?: AudioPlayerCallbacks;
  private playing: boolean = false;

  async init(callbacks?: AudioPlayerCallbacks): Promise<void> {
    this.callbacks = callbacks;

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioCtxClass();

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {}
    }

    await this.audioCtx.audioWorklet.addModule('/audio-player-processor.js');

    this.playerNode = new AudioWorkletNode(this.audioCtx, 'pcm-player-processor');
    this.playerNode.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.state) {
        this.playing = msg.state === 'speaking';
        this.callbacks?.onPlaybackStateChange?.(msg.state);
        if (msg.state === 'idle') {
          this.callbacks?.onVolumeChange?.(0);
        }
      }
    };

    this.playerNode.connect(this.audioCtx.destination);
  }

  async resume(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        console.log('[WebAudioPlayer] AudioContext resumed successfully, state:', this.audioCtx.state);
      } catch (e) {
        console.warn('[WebAudioPlayer] Failed to resume AudioContext:', e);
      }
    }
  }

  playPcmChunk(base64Pcm: string): void {
    if (!this.playerNode || !base64Pcm) return;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    try {
      // Decode base64 to binary byte string
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert Int16 little-endian samples to Float32 [-1.0, 1.0] and compute RMS
      const int16View = new Int16Array(bytes.buffer);
      const float32Samples = new Float32Array(int16View.length);
      let sumSquares = 0;
      for (let i = 0; i < int16View.length; i++) {
        const val = int16View[i];
        const norm = val < 0 ? val / 32768.0 : val / 32767.0;
        float32Samples[i] = norm;
        sumSquares += norm * norm;
      }

      const rms = Math.sqrt(sumSquares / int16View.length);
      const volume = Math.min(1, Math.max(0, rms * 5.0));
      this.callbacks?.onVolumeChange?.(volume);

      this.playerNode.port.postMessage({
        type: 'audio',
        samples: float32Samples,
      });
    } catch (err: any) {
      this.callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  flush(): void {
    this.playerNode?.port.postMessage({ type: 'flush' });
  }

  clear(): void {
    // Instant interruption / barge-in (< 300ms)
    this.playing = false;
    this.playerNode?.port.postMessage({ type: 'clear' });
    this.callbacks?.onPlaybackStateChange?.('idle');
    this.callbacks?.onVolumeChange?.(0);
  }

  async stop(): Promise<void> {
    this.clear();

    if (this.playerNode) {
      try {
        this.playerNode.disconnect();
      } catch {}
      this.playerNode = null;
    }

    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

export const createAudioPlayer = (): IAudioPlayer => new WebAudioPlayer();
