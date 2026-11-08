import { Platform } from 'react-native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';

export interface SoundCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
}

export interface UniversalSound {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setPlaybackRate: (rate: number) => void;
  seekTo?: (seconds: number) => void;
}

/**
 * Creates a universal sound player that works seamlessly on both Web and Native (iOS / Android)
 */
export function createUniversalSound(
  uri: string,
  callbacks?: SoundCallbacks,
  playbackSpeed: number = 1.0,
): UniversalSound {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
    const audio = new (window as any).Audio(uri);
    audio.playbackRate = playbackSpeed;

    const notifyTimeUpdate = () => {
      const cur = audio.currentTime || 0;
      const d = audio.duration;
      const validDur = typeof d === 'number' && isFinite(d) && !isNaN(d) && d > 0 ? d : 0;
      callbacks?.onTimeUpdate?.(cur, validDur);
    };

    audio.onloadedmetadata = notifyTimeUpdate;
    audio.ondurationchange = notifyTimeUpdate;
    audio.oncanplay = notifyTimeUpdate;
    audio.ontimeupdate = notifyTimeUpdate;

    audio.onended = () => {
      callbacks?.onEnded?.();
    };

    audio.onerror = (e: any) => {
      callbacks?.onError?.(e);
    };

    return {
      play: async () => {
        await audio.play();
      },
      pause: () => {
        try {
          audio.pause();
        } catch {}
      },
      stop: () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      },
      setPlaybackRate: (rate: number) => {
        audio.playbackRate = rate;
      },
      seekTo: (seconds: number) => {
        try {
          audio.currentTime = seconds;
        } catch {}
      },
    };
  }

  // Native mobile (iOS & Android) via expo-audio
  let player: AudioPlayer | null = null;
  let sub: { remove: () => void } | null = null;
  let isStopped = false;

  try {
    player = createAudioPlayer({ uri });
    if (playbackSpeed !== 1.0 && (player as any).setPlaybackRate) {
      try {
        (player as any).setPlaybackRate(playbackSpeed);
      } catch {}
    }

    sub = player.addListener('playbackStatusUpdate', (status) => {
      if (isStopped) return;
      // In expo-audio, currentTime and duration are already in SECONDS.
      // If legacy milliseconds (> 1000 for short clips), normalize safely.
      const rawCur = status.currentTime ?? 0;
      const rawDur = status.duration ?? 0;
      const cur = rawCur > 1000 ? rawCur / 1000 : rawCur;
      const dur = rawDur > 1000 ? rawDur / 1000 : rawDur;

      callbacks?.onTimeUpdate?.(cur, dur);

      if (status.didJustFinish) {
        callbacks?.onEnded?.();
      }
    });
  } catch (err) {
    callbacks?.onError?.(err);
  }

  return {
    play: async () => {
      isStopped = false;
      if (player) {
        player.play();
      }
    },
    pause: () => {
      try {
        player?.pause();
      } catch {}
    },
    stop: () => {
      isStopped = true;
      try {
        sub?.remove();
      } catch {}
      try {
        player?.pause();
      } catch {}
      try {
        (player as any)?.remove?.();
      } catch {}
    },
    setPlaybackRate: (rate: number) => {
      try {
        (player as any)?.setPlaybackRate?.(rate);
      } catch {}
    },
    seekTo: (seconds: number) => {
      try {
        // expo-audio seekTo takes seconds
        (player as any)?.seekTo?.(seconds);
      } catch {}
    },
  };
}

