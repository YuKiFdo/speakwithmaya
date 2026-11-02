import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';

export interface TranscriptTurnItem {
  id?: string;
  role: 'user' | 'model';
  text: string;
  audioUrl?: string | null;
  timestamp?: string;
}

export interface GrammarCorrectionItem {
  id?: string;
  studentSaid?: string;
  student_said?: string;
  moreNatural?: string;
  more_natural?: string;
  explanation?: string;
}

interface AdminSessionTranscriptAndPlayerProps {
  sessionId: string;
  studentName?: string;
  durationSeconds?: number;
  initialTurns?: TranscriptTurnItem[];
  initialCorrections?: GrammarCorrectionItem[];
  showCorrections?: boolean;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export function AdminSessionTranscriptAndPlayer({
  sessionId,
  studentName = 'Student',
  durationSeconds = 0,
  initialTurns,
}: AdminSessionTranscriptAndPlayerProps) {
  const baseUrl = getBackendBaseUrl();

  const [turns, setTurns] = useState<TranscriptTurnItem[]>(initialTurns || []);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [fullAudioUrl, setFullAudioUrl] = useState<string | null>(null);

  // Full Recording playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(durationSeconds || 0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [trackWidth, setTrackWidth] = useState<number>(0);

  const audioRef = useRef<any>(null);

  // Fetch full session detail (/v1/sessions/:id) so turns and fullConversationAudioUrl are populated
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data.turns) && data.turns.length > 0) {
            setTurns(data.turns);
          }
          setFullAudioUrl(data.fullConversationAudioUrl || null);
          if (data.durationSeconds && data.durationSeconds > 0) {
            setTotalDuration(data.durationSeconds);
          }
        }
      } catch {}
      finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [sessionId, baseUrl]);

  // Cleanup audio on unmount or sessionId change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch {}
        audioRef.current = null;
      }
    };
  }, [sessionId]);

  const getFullRecordingUrl = (): string => {
    if (fullAudioUrl) return fullAudioUrl;
    return `${baseUrl}/v1/sessions/${sessionId}/recording-audio?type=full`;
  };

  const initAudioIfNeeded = (): any => {
    if (audioRef.current) return audioRef.current;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

    const url = getFullRecordingUrl();
    const audio = new window.Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(Math.round(audio.duration));
      }
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setAudioError('No audio recording file found for this session.');
    };
    return audio;
  };

  const handleTogglePlay = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Linking.openURL(getFullRecordingUrl()).catch(() => {});
      return;
    }

    setAudioError(null);

    const audio = initAudioIfNeeded();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
          setAudioError('Recording audio is not available for this session.');
        });
    }
  };

  const seekTo = (targetSec: number) => {
    setAudioError(null);
    const boundedTime = Math.max(0, Math.min(totalDuration || 9999, targetSec));
    setCurrentTime(boundedTime);

    const audio = initAudioIfNeeded();
    if (audio) {
      try {
        audio.currentTime = boundedTime;
      } catch (err) {
        console.warn('Seek error:', err);
      }
    }
  };

  const seekBy = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  const handleSeekPress = (e: any) => {
    if (trackWidth <= 0) return;
    const clickX = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    const targetTime = Math.round(ratio * (totalDuration || 60));
    seekTo(targetTime);
  };

  const cycleSpeed = () => {
    const next = playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const progressPercent =
    totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;

  return (
    <View style={styles.container}>
      {/* 1. FULL SESSION AUDIO RECORDING PLAYER */}
      <View style={styles.audioPlayerCard}>
        <View style={styles.audioHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.audioIconBadge}>
              <Feather name="headphones" size={15} color="#0d9488" />
            </View>
            <View>
              <Text style={styles.audioSectionTitle}>Full Session Recording</Text>
              <Text style={styles.audioSectionSub}>
                Complete conversation audio between {studentName} and Maya
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open(getFullRecordingUrl(), '_blank');
              } else {
                Linking.openURL(getFullRecordingUrl()).catch(() => {});
              }
            }}
            style={({ pressed }) => [styles.downloadAudioBtn, pressed && { opacity: 0.75 }]}
          >
            <Feather name="download" size={13} color="#0d9488" />
            <Text style={styles.downloadAudioText}>Download WAV</Text>
          </Pressable>
        </View>

        {/* Playback Controls Row */}
        <View style={styles.playerControlsBar}>
          {/* Rewind 10s */}
          <Pressable
            onPress={() => seekBy(-10)}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Rewind 10 seconds"
          >
            <Ionicons name="play-back" size={16} color="#475569" />
          </Pressable>

          {/* Main Play / Pause Button */}
          <Pressable
            onPress={handleTogglePlay}
            style={({ pressed }) => [styles.playCircleBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color="#ffffff"
              style={!isPlaying ? { marginLeft: 2 } : undefined}
            />
          </Pressable>

          {/* Fast forward 10s */}
          <Pressable
            onPress={() => seekBy(10)}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Forward 10 seconds"
          >
            <Ionicons name="play-forward" size={16} color="#475569" />
          </Pressable>

          {/* Speed button */}
          <Pressable
            onPress={cycleSpeed}
            style={({ pressed }) => [styles.speedBadgeBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.speedBadgeText}>{playbackSpeed}x</Text>
          </Pressable>

          {/* Interactive Scrubber Track & Playhead */}
          <View
            style={styles.progressTrackWrap}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <Pressable
              onPress={handleSeekPress}
              style={styles.touchableTrackArea}
            >
              <View style={styles.progressTrackBg}>
                <View style={[styles.progressTrackFill, { width: `${progressPercent}%` }]} />
              </View>

              {/* Playhead Knob */}
              <View
                style={[
                  styles.playheadKnob,
                  { left: `${progressPercent}%` },
                ]}
              />
            </Pressable>

            <View style={styles.timeLabelsRow}>
              <Text style={styles.timeText}>{formatSec(currentTime)}</Text>
              <Text style={styles.timeText}>{formatSec(totalDuration)}</Text>
            </View>
          </View>
        </View>

        {audioError && <Text style={styles.audioErrorText}>{audioError}</Text>}
      </View>

      {/* 2. FULL CONVERSATION TRANSCRIPT */}
      <View style={styles.sectionBlock}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={styles.sectionHeaderTitle}>
            Full Conversation Transcript ({turns.length} turns)
          </Text>
          {isLoadingDetail && <ActivityIndicator size="small" color="#0d9488" />}
        </View>

        {turns.length === 0 ? (
          <View style={styles.emptyTranscriptBox}>
            <Feather name="message-circle" size={22} color="#94a3b8" />
            <Text style={styles.emptyTranscriptText}>
              {isLoadingDetail
                ? 'Loading conversation transcript...'
                : 'No transcript turns recorded for this session.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {turns.map((t, idx) => {
              const isModel = t.role === 'model';
              return (
                <View
                  key={t.id || idx}
                  style={[
                    styles.turnBubble,
                    isModel ? styles.turnBubbleModel : styles.turnBubbleUser,
                  ]}
                >
                  <View style={styles.turnHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.speakerDot,
                          { backgroundColor: isModel ? '#0d9488' : '#2563eb' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.turnRoleText,
                          { color: isModel ? '#0f766e' : '#1d4ed8' },
                        ]}
                      >
                        {isModel ? 'Maya (AI Coach)' : studentName}
                      </Text>
                      {t.timestamp ? (
                        <Text style={styles.turnTimeText}>
                          {new Date(t.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.turnMessageText}>{t.text}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  audioPlayerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 12,
  },
  audioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  audioIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSectionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0f172a',
  },
  audioSectionSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#64748b',
  },
  downloadAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  downloadAudioText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#0d9488',
  },
  trackTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trackTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  trackTabPillActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  trackTabText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#475569',
  },
  trackTabTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'semiBold'),
  },
  playerControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skipBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBadgeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  speedBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#0d9488',
  },
  touchableTrackArea: {
    height: 22,
    justifyContent: 'center',
    position: 'relative',
  },
  playheadKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0d9488',
    marginLeft: -7,
    top: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  playCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrackWrap: {
    flex: 1,
    gap: 5,
  },
  progressTrackBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressTrackFill: {
    height: '100%',
    backgroundColor: '#0d9488',
    borderRadius: 3,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
  },
  audioErrorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#dc2626',
  },
  sectionBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  sectionHeaderTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0f172a',
  },
  correctionBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    gap: 3,
  },
  corrStudentText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#b91c1c',
  },
  corrNaturalText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#15803d',
  },
  corrExplainText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#78350f',
    marginTop: 2,
  },
  emptyTranscriptBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyTranscriptText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748b',
  },
  turnBubble: {
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
  },
  turnBubbleModel: {
    backgroundColor: '#f0fdfa',
    borderColor: '#ccfbf1',
  },
  turnBubbleUser: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  turnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  speakerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  turnRoleText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11.5,
  },
  turnTimeText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.5,
    color: '#94a3b8',
  },
  turnAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  turnAudioBtnActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  turnAudioBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10.5,
    color: '#475569',
  },
  turnMessageText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    lineHeight: 19,
    color: '#1e293b',
  },
});
