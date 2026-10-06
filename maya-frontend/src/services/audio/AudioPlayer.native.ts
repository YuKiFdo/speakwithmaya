import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioPlaylist,
} from 'expo-audio';
import { IAudioPlayer, AudioPlayerCallbacks } from './AudioPlayer';

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function pcmToWavBase64(base64Pcm: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  const binaryString = atob(base64Pcm);
  const dataLength = binaryString.length;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Copy PCM data
  const u8 = new Uint8Array(buffer, 44);
  for (let i = 0; i < dataLength; i++) {
    u8[i] = binaryString.charCodeAt(i);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class NativeAudioPlayer implements IAudioPlayer {
  private callbacks?: AudioPlayerCallbacks;
  private playlist: AudioPlaylist | null = null;
  private statusSub: any = null;
  private queue: string[] = [];
  private isPlayingAudio: boolean = false;
  private readonly initialBatchSize: number = 6; // ~300ms initial buffer so ExoPlayer never starves
  private readonly chunkBatchSize: number = 8; // ~400ms per batch for smooth, gapless playback
  private idleDebounceTimer: any = null;

  async init(callbacks?: AudioPlayerCallbacks): Promise<void> {
    this.callbacks = callbacks;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'duckOthers',
      });
      console.log('[NativeAudioPlayer] AudioMode configured for native playback with expo-audio');
    } catch (e) {
      console.warn('[NativeAudioPlayer] Error initializing audio mode:', e);
    }

    this.setupPlaylist();
  }

  private setupPlaylist(): void {
    if (this.statusSub) {
      try {
        this.statusSub.remove();
      } catch {}
      this.statusSub = null;
    }

    if (this.idleDebounceTimer) {
      clearTimeout(this.idleDebounceTimer);
      this.idleDebounceTimer = null;
    }

    if (this.playlist) {
      try {
        this.playlist.destroy();
      } catch {}
      this.playlist = null;
    }

    try {
      this.playlist = createAudioPlaylist({
        sources: [],
        updateInterval: 50,
      });

      this.statusSub = this.playlist.addListener('playlistStatusUpdate', (status: any) => {
        const isPlaying = !!status.playing;
        const isBuffering = !!status.isBuffering;

        if (isPlaying || isBuffering) {
          if (this.idleDebounceTimer) {
            clearTimeout(this.idleDebounceTimer);
            this.idleDebounceTimer = null;
          }
          if (!this.isPlayingAudio) {
            this.isPlayingAudio = true;
            this.callbacks?.onPlaybackStateChange?.('speaking');
          }
        } else {
          // Check if playlist still has upcoming tracks or queued chunks to process
          const hasMoreTracks = status.trackCount > 0 && status.currentIndex < status.trackCount - 1;
          const hasQueued = this.queue.length > 0;

          if (hasMoreTracks || hasQueued) {
            if (this.idleDebounceTimer) {
              clearTimeout(this.idleDebounceTimer);
              this.idleDebounceTimer = null;
            }
            if (hasQueued) {
              this.enqueueBatchAndPlay();
            } else if (hasMoreTracks) {
              try {
                this.playlist?.play();
              } catch {}
            }
            return;
          }

          // Debounce idle declaration by 1000ms to allow final track and Android speaker buffer to finish draining completely
          if (!this.idleDebounceTimer && this.isPlayingAudio) {
            this.idleDebounceTimer = setTimeout(() => {
              if (this.queue.length > 0) {
                this.idleDebounceTimer = null;
                this.enqueueBatchAndPlay();
                return;
              }
              this.isPlayingAudio = false;
              this.callbacks?.onPlaybackStateChange?.('idle');
              this.callbacks?.onVolumeChange?.(0);
              this.idleDebounceTimer = null;
            }, 1000);
          }
        }
      });
    } catch (e) {
      console.warn('[NativeAudioPlayer] Error creating playlist:', e);
    }
  }

  async resume(): Promise<void> {}

  playPcmChunk(base64Pcm: string): void {
    if (!base64Pcm) return;

    if (this.idleDebounceTimer) {
      clearTimeout(this.idleDebounceTimer);
      this.idleDebounceTimer = null;
    }

    // Calculate RMS volume for speech-reactive animations on native
    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16View = new Int16Array(bytes.buffer);
      let sumSquares = 0;
      for (let i = 0; i < int16View.length; i++) {
        const norm = int16View[i] / 32768.0;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / int16View.length);
      const volume = Math.min(1, Math.max(0, rms * 5.0));
      this.callbacks?.onVolumeChange?.(volume);
    } catch {}

    this.queue.push(base64Pcm);

    // Start playing when initial buffer reaches initialBatchSize (~300ms)
    // While already playing, enqueue additional batches when chunkBatchSize is reached
    const requiredBatch = this.isPlayingAudio ? this.chunkBatchSize : this.initialBatchSize;
    if (this.queue.length >= requiredBatch) {
      this.enqueueBatchAndPlay();
    }
  }

  private assembleBatchWavUri(maxChunks?: number): string | null {
    if (this.queue.length === 0) return null;
    const limit = maxChunks ?? this.queue.length;
    const batch: string[] = [];
    while (this.queue.length > 0 && batch.length < limit) {
      batch.push(this.queue.shift()!);
    }

    let combinedBinary = '';
    for (const c of batch) {
      combinedBinary += atob(c);
    }
    const combinedBase64 = btoa(combinedBinary);
    const wavBase64 = pcmToWavBase64(combinedBase64, 24000, 1, 16);
    return `data:audio/wav;base64,${wavBase64}`;
  }

  private enqueueBatchAndPlay(drainAll: boolean = false): void {
    if (!this.playlist) {
      this.setupPlaylist();
    }
    if (!this.playlist || this.queue.length === 0) return;

    if (this.idleDebounceTimer) {
      clearTimeout(this.idleDebounceTimer);
      this.idleDebounceTimer = null;
    }

    // Drain all available chunks or up to chunkBatchSize * 2 to minimize track switches
    const dataUri = this.assembleBatchWavUri(drainAll ? undefined : Math.min(this.queue.length, this.chunkBatchSize * 2));
    if (!dataUri) return;

    try {
      if (!this.isPlayingAudio) {
        console.log('[NativeAudioPlayer] Starting new speech turn -> resetting playlist for track 0');
        this.setupPlaylist();
        this.playlist!.add({ uri: dataUri });
        this.isPlayingAudio = true;
        this.callbacks?.onPlaybackStateChange?.('speaking');
        this.playlist!.play();
      } else {
        this.playlist.add({ uri: dataUri });
        // Critical for Android ExoPlayer: if the previous track finished before this one was added,
        // calling play() restarts playback of the appended item so it never gets stuck!
        this.playlist.play();
      }
    } catch (err) {
      console.warn('[NativeAudioPlayer] Error adding audio batch to playlist:', err);
    }
  }

  flush(): void {
    // When turn completes, cancel any pending idle timer and flush remaining chunks into playlist in a single batch
    if (this.idleDebounceTimer) {
      clearTimeout(this.idleDebounceTimer);
      this.idleDebounceTimer = null;
    }
    if (this.queue.length > 0) {
      this.enqueueBatchAndPlay(true);
    }
  }

  clear(): void {
    // Instant barge-in interruption (< 300ms)
    this.queue = [];
    this.isPlayingAudio = false;

    if (this.idleDebounceTimer) {
      clearTimeout(this.idleDebounceTimer);
      this.idleDebounceTimer = null;
    }

    if (this.playlist) {
      try {
        this.playlist.pause();
        this.playlist.clear();
      } catch {}
    }

    this.callbacks?.onPlaybackStateChange?.('idle');
    this.callbacks?.onVolumeChange?.(0);
  }

  playFloat32Chunk(samples: Float32Array): void {
    if (!samples || samples.length === 0) return;
    const len = samples.length;
    const int16 = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    this.playPcmChunk(btoa(binary));
  }

  async stop(): Promise<void> {
    this.clear();
  }

  isPlaying(): boolean {
    return this.isPlayingAudio;
  }
}

export const createAudioPlayer = (): IAudioPlayer => new NativeAudioPlayer();
