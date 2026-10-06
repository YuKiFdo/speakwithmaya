import { Platform } from 'react-native';
import { WebAudioPlayer } from './AudioPlayer.web';
import { NativeAudioPlayer } from './AudioPlayer.native';

export interface AudioPlayerCallbacks {
  onPlaybackStateChange?: (state: 'idle' | 'speaking') => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (error: Error) => void;
}

export interface IAudioPlayer {
  init(callbacks?: AudioPlayerCallbacks): Promise<void>;
  resume(): Promise<void>;
  playPcmChunk(base64Pcm: string): void;
  playFloat32Chunk?(samples: Float32Array): void;
  flush(): void;
  clear(): void; // Barge-in instant interruption
  stop(): Promise<void>;
  isPlaying(): boolean;
}

export const createAudioPlayer = (): IAudioPlayer => {
  return Platform.OS === 'web' ? new WebAudioPlayer() : new NativeAudioPlayer();
};
