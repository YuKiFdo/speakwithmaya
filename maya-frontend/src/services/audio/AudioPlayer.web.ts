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
    console.log('[WebAudioPlayer] 🔊 AudioContext created, initial state:', this.audioCtx.state);

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        console.log('[WebAudioPlayer] 🔊 AudioContext resumed during init, state:', this.audioCtx.state);
      } catch (e: any) {
        console.warn('[WebAudioPlayer] ⚠️ AudioContext suspended on init (waiting for user gesture):', e?.message);
      }
    }

    // iOS Safari WebAudio unlock: play 1-sample silent buffer directly to destination
    try {
      const silentBuffer = this.audioCtx.createBuffer(1, 1, 24000);
      const source = this.audioCtx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
    } catch {}

    // Global interaction listener to immediately un-suspend AudioContext on user touch/click
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.audioCtx && (this.audioCtx.state === 'suspended' || (this.audioCtx as any).state === 'interrupted')) {
          this.audioCtx.resume().then(() => {
            console.log('[WebAudioPlayer] 🔊 AudioContext resumed via user touch/click, state:', this.audioCtx?.state);
          }).catch(() => {});
        }
      };
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('touchend', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
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
    if (this.audioCtx && (this.audioCtx.state === 'suspended' || (this.audioCtx as any).state === 'interrupted')) {
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
      console.warn('[WebAudioPlayer] ⚠️ AudioContext is suspended while playPcmChunk called! Auto-resuming...');
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

  playFloat32Chunk(samples: Float32Array): void {
    if (!this.playerNode || !samples || samples.length === 0) return;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      console.warn('[WebAudioPlayer] ⚠️ AudioContext is suspended while playFloat32Chunk called! Auto-resuming...');
      this.audioCtx.resume().catch(() => {});
    }

    try {
      // Calculate RMS for visual volume feedback
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const volume = Math.min(1, Math.max(0, rms * 5.0));
      this.callbacks?.onVolumeChange?.(volume);

      // Post Float32 samples directly to PCM player AudioWorklet
      this.playerNode.port.postMessage({
        type: 'audio',
        samples,
      });
    } catch (err: any) {
      this.callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  flush(): void {
    this.playerNode?.port.postMessage({ type: 'flush' });
  }

  setJitterBuffer(targetMs: number): void {
    const prebufferSamples = Math.round((targetMs / 1000) * 24000);
    this.playerNode?.port.postMessage({
      type: 'set_jitter_buffer',
      prebufferSamples,
    });
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
