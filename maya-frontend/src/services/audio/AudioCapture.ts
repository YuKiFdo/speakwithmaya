import { Platform } from 'react-native';
import { WebAudioCapture } from './AudioCapture.web';
import { NativeAudioCapture } from './AudioCapture.native';

export interface AudioCaptureCallbacks {
  onAudioData: (pcm16Chunk: ArrayBuffer) => void;
  onVolumeChange?: (volume: number) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface IAudioCapture {
  start(callbacks: AudioCaptureCallbacks): Promise<void>;
  stop(): Promise<void>;
  isRecording(): boolean;
}

export const createAudioCapture = (): IAudioCapture => {
  return Platform.OS === 'web' ? new WebAudioCapture() : new NativeAudioCapture();
};
