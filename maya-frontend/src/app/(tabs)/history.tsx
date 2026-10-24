import React, { useState, useRef, useMemo, useEffect, useCallback, useTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { fontStyle } from '@/theme/fonts';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';

import {
  SearchIcon,
  FilterLinesIcon,
  MoreVerticalIcon,
  HistoryPlayIcon,
  HistoryPauseIcon,
  CalendarSmallIcon,
  ClockSmallIcon,
  TimerSmallIcon,
  RefreshCorrectionsIcon,
  VolumeSpeakerIcon,
  NextCorrectionIcon,
  CloseCrossIcon,
  ChevronLeftIcon,
  ModeWorkplaceIcon,
  ModeChatBubbleIcon,
  ModeUserAvatarIcon,
  ModePhoneIcon,
  ModeTravelIcon,
} from '@/components/icons/history-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { MobileTopBar } from '@/components/navigation/mobile-top-bar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { HistoryDetailSkeleton } from '@/components/ui/skeleton';
import { fetchAllPracticeSessions, isIntroSessionTopic } from '@/services/supabase';
import { useUserStats } from '@/hooks/useUserStats';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PracticeMode = 'all' | 'workplace' | 'casual' | 'interview' | 'phone' | 'travel';

export interface CorrectionItem {
  id: string;
  countText: string;
  originalText: string;
  strikethroughPart: string;
  correctedText: string;
  highlightCorrectedPart: string;
  whyExplanation: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: 'user' | 'ai';
  time: string;
  message: string;
  audioUrl?: string | null;
  correction?: CorrectionItem;
}

export interface HistorySession {
  id: string;
  mode: PracticeMode;
  title: string;
  dateGroup: 'Today' | 'Yesterday' | 'May 25, 2026' | string;
  dateString: string;
  timeString: string;
  durationString: string;
  durationSeconds: number;
  correctionsCount: number;
  recordingLengthString: string;
  fullConversationAudioUrl?: string | null;
  userAudioUrl?: string | null;
  modelAudioUrl?: string | null;
  user_rating?: number | null;
  user_feedback?: string | null;
  transcript: TranscriptTurn[];
  corrections?: CorrectionItem[];
  scores?: {
    overall: number;
    fluency: number;
    grammar: number;
    pronunciation: number;
  };
}


function parseIsoDateSafe(dateInput?: string | null): Date {
  if (!dateInput) return new Date();
  let clean = dateInput.trim();
  if (!clean.endsWith('Z') && !clean.match(/[+-]\d{2}(:?\d{2})?$/)) {
    if (clean.includes('T')) clean = `${clean}Z`;
    else if (clean.includes(' ')) clean = `${clean.replace(' ', 'T')}Z`;
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? new Date(dateInput) : d;
}

// Helper to generate dynamic conversational speech amplitude envelope
function generateSpeechEnvelopeBars(count = 42): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (i / count) * Math.PI * 4;
    const wave = Math.abs(Math.sin(phase) * Math.cos(phase * 1.35));
    const randomVariation = 0.75 + (Math.sin(i * 11.7) * 0.25);
    const h = Math.max(8, Math.min(38, Math.round(wave * 32 * randomVariation + 8)));
    result.push(h);
  }
  return result;
}

function formatAudioTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remainingS = s % 60;
  return `${m}:${remainingS < 10 ? '0' : ''}${remainingS}`;
}

function withCacheBust(url?: string | null): string {
  if (!url) return '';
  const clean = url.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}_cb=${Date.now()}`;
}



// Helper to render mode icon
function renderModeIcon(mode: PracticeMode, size = 20) {
  switch (mode) {
    case 'workplace':
      return <ModeWorkplaceIcon size={size} color="#10B981" />;
    case 'casual':
      return <ModeChatBubbleIcon size={size} color="#2563EB" />;
    case 'interview':
      return <ModeUserAvatarIcon size={size} color="#EA580C" />;
    case 'phone':
      return <ModePhoneIcon size={size} color="#DB2777" />;
    case 'travel':
      return <ModeTravelIcon size={size} color="#0284C7" />;
    default:
      return <ModeWorkplaceIcon size={size} color="#10B981" />;
  }
}

function getModeBadgeBg(mode: PracticeMode): string {
  switch (mode) {
    case 'workplace':
      return '#ECFDF5';
    case 'casual':
      return '#EFF6FF';
    case 'interview':
      return '#FFF7ED';
    case 'phone':
      return '#FDF2F8';
    case 'travel':
      return '#F0F9FF';
    default:
      return '#ECFDF5';
  }
}

// In-memory module cache so navigating to the History tab is instant
let cachedHistorySessions: HistorySession[] | null = null;
const waveformBarsCache = new Map<string, number[]>();

// Inject web animation styles once
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'history-animation-keyframes';
  if (!document.getElementById(styleId)) {
    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.innerHTML = `
      @keyframes historyDetailFadeIn {
        from {
          opacity: 0.35;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(styleTag);
  }
}

interface SessionCardProps {
  item: HistorySession;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onTogglePlay: (e: any, item: HistorySession) => void;
  isPlayingThisSession: boolean;
  isAudioUnreachable: boolean;
}

const DesktopSessionCard = React.memo(function DesktopSessionCard({
  item,
  isSelected,
  onSelect,
  onTogglePlay,
  isPlayingThisSession,
  isAudioUnreachable,
}: SessionCardProps) {
  const hasAudio = Boolean(
    (item.fullConversationAudioUrl && !isAudioUnreachable) ||
    (item.userAudioUrl && !isAudioUnreachable) ||
    (item.modelAudioUrl && !isAudioUnreachable) ||
    (item.transcript && item.transcript.some((t) => Boolean(t.audioUrl && !isAudioUnreachable)))
  );

  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.sessionCard,
        hovered && !isSelected && styles.sessionCardHovered,
        isSelected && styles.sessionCardSelected,
        pressed && styles.sessionCardPressed,
      ]}
      onPress={() => onSelect(item.id)}
    >
      {/* Mode Icon in Colored Square */}
      <View
        style={[
          styles.modeIconSquare,
          { backgroundColor: getModeBadgeBg(item.mode) },
          isSelected && styles.modeIconSquareSelected,
        ]}
      >
        {renderModeIcon(item.mode, 20)}
      </View>

      {/* Center Info */}
      <View style={styles.sessionCardCenter}>
        <Text style={styles.sessionCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.sessionMetaRow}>
          <View style={styles.metaItem}>
            <CalendarSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.dateString}</Text>
          </View>
          <Text style={styles.metaDot}>•</Text>
          <View style={styles.metaItem}>
            <ClockSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.timeString}</Text>
          </View>
          <Text style={styles.metaDot}>•</Text>
          <View style={styles.metaItem}>
            <TimerSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.durationString}</Text>
          </View>
          <Text style={styles.metaDot}>•</Text>
          <View style={styles.metaItem}>
            <RefreshCorrectionsIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>
              {item.correctionsCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Right Side: Play Button & Options */}
      <View style={styles.sessionCardActions}>
        {hasAudio ? (
          <Pressable
            style={({ pressed }: any) => [
              styles.cardPlayButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
            onPress={(e) => onTogglePlay(e, item)}
            accessibilityRole="button"
            accessibilityLabel="Play conversation recording"
          >
            {isPlayingThisSession ? (
              <HistoryPauseIcon size={34} color="#2B5BFF" />
            ) : (
              <HistoryPlayIcon size={34} color="#2B5BFF" />
            )}
          </Pressable>
        ) : (
          <View
            style={styles.cardNoAudioPill}
            accessibilityLabel="Voice recording not available"
          >
            <Ionicons name="mic-off-outline" size={13} color="#94A3B8" />
            <Text style={styles.cardNoAudioPillText}>No audio</Text>
          </View>
        )}
        <Pressable
          style={styles.cardMoreButton}
          onPress={(e) => e.stopPropagation?.()}
          hitSlop={8}
        >
          <MoreVerticalIcon color="#94A3B8" size={16} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const MobileSessionCard = React.memo(function MobileSessionCard({
  item,
  isSelected,
  onSelect,
  onTogglePlay,
  isPlayingThisSession,
  isAudioUnreachable,
}: SessionCardProps) {
  const hasAudio = Boolean(
    (item.fullConversationAudioUrl && !isAudioUnreachable) ||
    (item.userAudioUrl && !isAudioUnreachable) ||
    (item.modelAudioUrl && !isAudioUnreachable) ||
    (item.transcript && item.transcript.some((t) => Boolean(t.audioUrl && !isAudioUnreachable)))
  );

  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.mobileSessionCard,
        hovered && !isSelected && styles.sessionCardHovered,
        isSelected && styles.mobileSessionCardSelected,
        pressed && styles.mobileSessionCardPressed,
      ]}
      onPress={() => onSelect(item.id)}
    >
      <View
        style={[
          styles.modeIconSquare,
          { backgroundColor: getModeBadgeBg(item.mode) },
          isSelected && styles.modeIconSquareSelected,
        ]}
      >
        {renderModeIcon(item.mode, 22)}
      </View>

      <View style={styles.sessionCardCenter}>
        <Text style={styles.sessionCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.mobileCardMetaGrid}>
          <View style={styles.metaItem}>
            <CalendarSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.dateString}</Text>
          </View>
          <View style={styles.metaItem}>
            <ClockSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.timeString}</Text>
          </View>
          <View style={styles.metaItem}>
            <TimerSmallIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>{item.durationString}</Text>
          </View>
          <View style={styles.metaItem}>
            <RefreshCorrectionsIcon color="#94A3B8" size={12} />
            <Text style={styles.metaText}>
              {item.correctionsCount} corrections
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sessionCardActions}>
        {hasAudio ? (
          <Pressable
            style={({ pressed }: any) => [
              styles.cardPlayButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
            onPress={(e) => onTogglePlay(e, item)}
            accessibilityRole="button"
            accessibilityLabel="Play conversation recording"
          >
            {isPlayingThisSession ? (
              <HistoryPauseIcon size={34} color="#2B5BFF" />
            ) : (
              <HistoryPlayIcon size={34} color="#2B5BFF" />
            )}
          </Pressable>
        ) : (
          <View
            style={styles.cardNoAudioPill}
            accessibilityLabel="Voice recording not available"
          >
            <Ionicons name="mic-off-outline" size={13} color="#94A3B8" />
            <Text style={styles.cardNoAudioPillText}>No audio</Text>
          </View>
        )}
        <Pressable
          style={styles.cardMoreButton}
          onPress={(e) => e.stopPropagation?.()}
          hitSlop={8}
        >
          <MoreVerticalIcon color="#94A3B8" size={18} />
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const stats = useUserStats();
  const displayName = stats.displayName || params.name || 'Learner';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  // Navigation & Popups
  const [activeTab, setActiveTab] = useState<DashboardTab>('history');
  const isPro = stats.isPro;
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<PracticeMode>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Immediate UI selection state for instantaneous card animation
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // Heavy detail view state (transitioned concurrently to keep list clicks 60fps)
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSelectSession = useCallback((id: string | null) => {
    setSelectedSessionId(id);
    startTransition(() => {
      setDetailSessionId(id);
    });
  }, [startTransition]);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => generateSpeechEnvelopeBars(42));
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [collapsedCorrections, setCollapsedCorrections] = useState<Record<string, boolean>>({});
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
  const [unreachableAudioUrls, setUnreachableAudioUrls] = useState<Set<string>>(new Set());

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioSessionIdRef = useRef<string | null>(null);
  const playlistIndexRef = useRef<number>(-1);
  const isPlaylistModeRef = useRef<boolean>(false);

  // Stop active audio helper
  const stopAudio = () => {
    isPlaylistModeRef.current = false;
    playlistIndexRef.current = -1;
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    activeAudioSessionIdRef.current = null;
    setIsPlaying(false);
    setPlayingTurnId(null);
    setPlaybackProgress(0);
    setCurrentTimeSeconds(0);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // When switching selected session, stop previous audio
  useEffect(() => {
    if (activeAudioSessionIdRef.current && selectedSessionId && activeAudioSessionIdRef.current !== selectedSessionId) {
      stopAudio();
    }
  }, [selectedSessionId]);

  // Transcript scroll ref for "Jump to Next Correction"
  const transcriptScrollRef = useRef<ScrollView>(null);
  const correctionPositions = useRef<{ [id: string]: number }>({});
  const lastCorrectionIndexScrolled = useRef<number>(-1);

  // Dynamic & cached practice sessions
  const [allSessions, setAllSessions] = useState<HistorySession[]>(() =>
    (cachedHistorySessions || []).filter((s) => !isIntroSessionTopic(s.title))
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedHistorySessions || cachedHistorySessions.length === 0);


  // Synchronize desktop selection
  useEffect(() => {
    if (isDesktop && !selectedSessionId && allSessions.length > 0) {
      setSelectedSessionId(allSessions[0].id);
      setDetailSessionId(allSessions[0].id);
    }
  }, [isDesktop, selectedSessionId, allSessions]);

  // Handle Tab Switch
  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.push({ pathname: '/dashboard', params });
    } else if (tab === 'roadmap') {
      router.push({ pathname: '/roadmap', params });
    } else if (tab === 'account') {
      router.push({ pathname: '/account', params });
    } else {
      setActiveTab(tab);
    }
  };


  useEffect(() => {
    fetchAllPracticeSessions().then((records) => {
      const validRecords = (records || []).filter(
        (r) => !isIntroSessionTopic(r.topic, r.scenario_title || r.scenarioTitle, r.scenario_id || r.scenarioId)
      );
      if (validRecords && validRecords.length > 0) {
        const converted: HistorySession[] = validRecords.map((r, idx) => {
          const d = parseIsoDateSafe(r.start_time);
          const durationMin = Math.max(1, Math.ceil((r.duration_seconds || 60) / 60));
          const durSecs = (r.duration_seconds || 0) % 60;
          const recordingLengthString = `${Math.floor((r.duration_seconds || 0) / 60)}:${durSecs < 10 ? '0' : ''}${durSecs}`;

          const now = new Date();
          const isSameDay = (d1: Date, d2: Date) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);

          let dateGroup = 'Today';
          if (!isNaN(d.getTime())) {
            if (isSameDay(d, now)) {
              dateGroup = 'Today';
            } else if (isSameDay(d, yesterday)) {
              dateGroup = 'Yesterday';
            } else {
              dateGroup = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            }
          }

          const rawCorrections = r.corrections || [];
          const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

          const unassignedCorrections = rawCorrections.map((c, i) => {
            const saidNorm = normalize(c.studentSaid);
            return {
              id: c.id || `corr-${r.id}-${i}`,
              countText: `1 correction`,
              originalText: c.studentSaid,
              strikethroughPart: c.highlightWords?.[0] || c.studentSaid,
              correctedText: c.moreNatural,
              highlightCorrectedPart: c.highlightWords?.[0] || c.moreNatural,
              whyExplanation: c.explanation,
              studentSaidNormalized: saidNorm,
              saidWords: saidNorm.split(' ').filter((w) => w.length > 1),
              timestamp: c.timestamp,
              used: false,
            };
          });

          // Deduplicate consecutive identical turns (e.g. from historical duplicate events)
          const rawTurns = r.turns && r.turns.length > 0 ? r.turns : [];
          let turnsList: Array<{ role: 'user' | 'model'; text: string; audioUrl?: string | null; timestamp?: string }> = [];
          for (const t of rawTurns) {
            const prev = turnsList[turnsList.length - 1];
            if (!prev || prev.role !== t.role || prev.text.trim() !== t.text.trim()) {
              turnsList.push(t);
            }
          }

          // Filter out phantom opening Sinhala affirmative carrier artifact ("ඔව්.") before model greeting
          if (
            turnsList.length > 1 &&
            turnsList[0].role === 'user' &&
            (turnsList[0].text.trim() === 'ඔව්.' || turnsList[0].text.trim() === 'ඔව්') &&
            (turnsList[1].role === 'model' || (turnsList[1] as any).role === 'ai')
          ) {
            turnsList = turnsList.slice(1);
          }

          // Pre-assign corrections using multi-pass matching
          const turnCorrections: Array<CorrectionItem | undefined> = new Array(turnsList.length).fill(undefined);

          // PASS 1: Exact substring match
          unassignedCorrections.forEach((c) => {
            if (c.used || !c.studentSaidNormalized) return;
            const matchTurnIdx = turnsList.findIndex((t, idx) => {
              if (t.role !== 'user' || turnCorrections[idx]) return false;
              const userNorm = normalize(t.text);
              return userNorm.includes(c.studentSaidNormalized) || c.studentSaidNormalized.includes(userNorm);
            });
            if (matchTurnIdx !== -1) {
              c.used = true;
              turnCorrections[matchTurnIdx] = {
                id: c.id,
                countText: c.countText,
                originalText: c.originalText,
                strikethroughPart: c.strikethroughPart,
                correctedText: c.correctedText,
                highlightCorrectedPart: c.highlightCorrectedPart,
                whyExplanation: c.whyExplanation,
              };
            }
          });

          // PASS 2: Significant word overlap match (>= 60% of mistake words match user turn)
          unassignedCorrections.forEach((c) => {
            if (c.used || c.saidWords.length === 0) return;
            const matchTurnIdx = turnsList.findIndex((t, idx) => {
              if (t.role !== 'user' || turnCorrections[idx]) return false;
              const userNorm = normalize(t.text);
              const matchedWords = c.saidWords.filter((w) => userNorm.includes(w)).length;
              return matchedWords / c.saidWords.length >= 0.6;
            });
            if (matchTurnIdx !== -1) {
              c.used = true;
              turnCorrections[matchTurnIdx] = {
                id: c.id,
                countText: c.countText,
                originalText: c.originalText,
                strikethroughPart: c.strikethroughPart,
                correctedText: c.correctedText,
                highlightCorrectedPart: c.highlightCorrectedPart,
                whyExplanation: c.whyExplanation,
              };
            }
          });

          // PASS 3: Fallback for any leftover unassigned corrections
          unassignedCorrections.forEach((c) => {
            if (c.used) return;
            const emptyUserTurnIdx = turnsList.findIndex((t, idx) => t.role === 'user' && !turnCorrections[idx]);
            if (emptyUserTurnIdx !== -1) {
              c.used = true;
              turnCorrections[emptyUserTurnIdx] = {
                id: c.id,
                countText: c.countText,
                originalText: c.originalText,
                strikethroughPart: c.strikethroughPart,
                correctedText: c.correctedText,
                highlightCorrectedPart: c.highlightCorrectedPart,
                whyExplanation: c.whyExplanation,
              };
            }
          });

          const transcript: TranscriptTurn[] = turnsList.map((t, i) => {
            let turnTimeString = '';
            if (t.timestamp) {
              const tDate = parseIsoDateSafe(t.timestamp);
              if (!isNaN(tDate.getTime())) {
                turnTimeString = tDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              }
            }
            if (!turnTimeString) {
              const mins = Math.floor(i / 2);
              const secs = (i % 2) * 30;
              turnTimeString = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }

            return {
              id: `turn-${r.id}-${i}`,
              speaker: t.role === 'model' ? 'ai' : 'user',
              time: turnTimeString,
              message: t.text,
              audioUrl: t.audioUrl || null,
              correction: turnCorrections[i],
            };
          });


          // If no transcript turns were recorded but corrections exist, generate turn items from corrections
          if (transcript.length === 0 && unassignedCorrections.length > 0) {
            unassignedCorrections.forEach((c, idx) => {
              transcript.push({
                id: `turn-${r.id}-user-${idx}`,
                speaker: 'user',
                time: !isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
                message: c.originalText,
                audioUrl: null,
                correction: {
                  id: c.id,
                  countText: c.countText,
                  originalText: c.originalText,
                  strikethroughPart: c.strikethroughPart,
                  correctedText: c.correctedText,
                  highlightCorrectedPart: c.highlightCorrectedPart,
                  whyExplanation: c.whyExplanation,
                },
              });
              transcript.push({
                id: `turn-${r.id}-ai-${idx}`,
                speaker: 'ai',
                time: !isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
                message: `Great speaking! Remember: ${c.whyExplanation}`,
                audioUrl: null,
              });
            });
          }

          // If still completely empty
          if (transcript.length === 0) {
            transcript.push({
              id: `turn-${r.id}-0`,
              speaker: 'ai',
              time: !isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              message: 'Practice session completed successfully.',
              audioUrl: null,
            });
          }

          let mode: PracticeMode = 'casual';
          const tLower = (r.topic || '').toLowerCase();
          if (tLower.includes('interview')) mode = 'interview';
          else if (tLower.includes('workplace') || tLower.includes('business')) mode = 'workplace';
          else if (tLower.includes('phone') || tLower.includes('call')) mode = 'phone';
          else if (tLower.includes('travel') || tLower.includes('tour')) mode = 'travel';

          return {
            id: r.id,
            mode,
            title: r.topic || 'General Practice',
            dateGroup,
            dateString: isNaN(d.getTime())
              ? 'Today'
              : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            timeString: isNaN(d.getTime())
              ? 'Just now'
              : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            durationString: `${durationMin} mins`,
            recordingLengthString,
            durationSeconds: r.duration_seconds || 60,
            correctionsCount: rawCorrections.length,
            fullConversationAudioUrl: r.fullConversationAudioUrl || null,
            userAudioUrl: r.userAudioUrl || null,
            modelAudioUrl: r.modelAudioUrl || null,
            user_rating: r.user_rating ?? null,
            user_feedback: r.user_feedback ?? null,
            scores: {
              overall: r.overall_score || 85,
              fluency: r.fluency_score || 84,
              grammar: r.grammar_score || 82,
              pronunciation: r.pronunciation_score || 80,
            },
            transcript,
            corrections: rawCorrections.map((c, i) => ({
              id: c.id || `corr-${r.id}-${i}`,
              countText: `1 correction`,
              originalText: c.studentSaid,
              strikethroughPart: c.highlightWords?.[0] || c.studentSaid,
              correctedText: c.moreNatural,
              highlightCorrectedPart: c.highlightWords?.[0] || c.moreNatural,
              whyExplanation: c.explanation,
            })),
          };
        });

        cachedHistorySessions = converted;
        setAllSessions(converted);
        setIsLoading(false);

        // Automatically select the latest real session for desktop
        if (converted.length > 0) {
          setSelectedSessionId((prev) => (prev ? prev : isDesktop ? converted[0].id : null));
          setDetailSessionId((prev) => (prev ? prev : isDesktop ? converted[0].id : null));
        }
      } else {
        cachedHistorySessions = [];
        setAllSessions([]);
        setSelectedSessionId(null);
        setDetailSessionId(null);
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });
  }, [isDesktop]);



  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      if (isIntroSessionTopic(session.title)) return false;
      const matchesSearch =
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.dateString.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.transcript.some((t) =>
          t.message.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesMode =
        selectedMode === 'all' || session.mode === selectedMode;

      return matchesSearch && matchesMode;
    });
  }, [allSessions, searchQuery, selectedMode]);

  // Grouped by Date
  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: HistorySession[] } = {};
    for (const session of filteredSessions) {
      if (!groups[session.dateGroup]) {
        groups[session.dateGroup] = [];
      }
      groups[session.dateGroup].push(session);
    }
    return groups;
  }, [filteredSessions]);

  // Currently Selected Session
  const activeSession = useMemo(() => {
    const targetId = detailSessionId || selectedSessionId;
    return (
      allSessions.find((s) => s.id === targetId) || (isDesktop ? allSessions[0] : null)
    );
  }, [allSessions, detailSessionId, selectedSessionId, isDesktop]);

  // Check if active session has any stored audio recordings
  const hasActiveRecording = useMemo(() => {
    if (!activeSession) return false;
    const hasFull = Boolean(activeSession.fullConversationAudioUrl && !unreachableAudioUrls.has(activeSession.fullConversationAudioUrl));
    const hasUser = Boolean(activeSession.userAudioUrl && !unreachableAudioUrls.has(activeSession.userAudioUrl));
    const hasModel = Boolean(activeSession.modelAudioUrl && !unreachableAudioUrls.has(activeSession.modelAudioUrl));
    const hasTurns = Boolean(
      activeSession.transcript &&
      activeSession.transcript.some((t) => Boolean(t.audioUrl && !unreachableAudioUrls.has(t.audioUrl)))
    );

    return hasFull || hasUser || hasModel || hasTurns;
  }, [activeSession, unreachableAudioUrls]);


  // Extract volume levels from actual audio file or speech envelope
  useEffect(() => {
    if (!activeSession) return;
    const durSec = activeSession.durationSeconds || 17;
    setTotalDurationSeconds(durSec);
    setCurrentTimeSeconds(0);
    setPlaybackProgress(0);

    // If already computed and cached, load instantly!
    if (waveformBarsCache.has(activeSession.id)) {
      setWaveformBars(waveformBarsCache.get(activeSession.id)!);
      return;
    }

    const baseUrl = getBackendBaseUrl();
    const resolvedUrl = activeSession.fullConversationAudioUrl ||
      activeSession.userAudioUrl ||
      activeSession.modelAudioUrl ||
      (activeSession.id ? `${baseUrl}/v1/sessions/${activeSession.id}/recording-audio?type=full` : '');
    const audioUrl = resolvedUrl.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');

    if (!audioUrl || unreachableAudioUrls.has(audioUrl) || typeof window === 'undefined') {
      const generated = generateSpeechEnvelopeBars(42);
      waveformBarsCache.set(activeSession.id, generated);
      setWaveformBars(generated);
      return;
    }

    let isMounted = true;
    const numBars = 42;

    // Small delay ensures decoding does not compete with the smooth active selection transition
    const decodeTimer = setTimeout(async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          if (isMounted) {
            const gen = generateSpeechEnvelopeBars(numBars);
            waveformBarsCache.set(activeSession.id, gen);
            setWaveformBars(gen);
          }
          return;
        }

        const res = await fetch(withCacheBust(audioUrl));
        if (!res.ok) {
          if (isMounted) {
            setUnreachableAudioUrls((prev) => new Set(prev).add(audioUrl));
            const gen = generateSpeechEnvelopeBars(numBars);
            waveformBarsCache.set(activeSession.id, gen);
            setWaveformBars(gen);
          }
          return;
        }

        const arrayBuffer = await res.arrayBuffer();
        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        if (!channelData || channelData.length === 0) {
          if (isMounted) {
            const gen = generateSpeechEnvelopeBars(numBars);
            waveformBarsCache.set(activeSession.id, gen);
            setWaveformBars(gen);
          }
          return;
        }

        const samplesPerBar = Math.floor(channelData.length / numBars);
        const extracted: number[] = [];

        for (let i = 0; i < numBars; i++) {
          let sumSquares = 0;
          const start = i * samplesPerBar;
          for (let j = 0; j < samplesPerBar; j++) {
            const val = channelData[start + j] || 0;
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, samplesPerBar));
          // Scale RMS amplitude into height between 7px and 38px
          const barHeight = Math.max(7, Math.min(38, Math.round(rms * 160 + 8)));
          extracted.push(barHeight);
        }

        if (isMounted && extracted.length === numBars) {
          waveformBarsCache.set(activeSession.id, extracted);
          setWaveformBars(extracted);
          if (audioBuffer.duration && audioBuffer.duration > 0) {
            setTotalDurationSeconds(Math.round(audioBuffer.duration));
          }
        }
      } catch {
        if (isMounted) {
          setUnreachableAudioUrls((prev) => new Set(prev).add(audioUrl));
          const gen = generateSpeechEnvelopeBars(numBars);
          waveformBarsCache.set(activeSession.id, gen);
          setWaveformBars(gen);
        }
      }
    }, 60);

    return () => {
      isMounted = false;
      clearTimeout(decodeTimer);
    };
  }, [activeSession?.id, activeSession?.fullConversationAudioUrl, activeSession?.userAudioUrl, unreachableAudioUrls]);

  // Play individual turn in conversational sequential playlist (REAL RECORDED AUDIO ONLY)
  const playTurnInSequence = (session: HistorySession, turnIdx: number) => {
    const turns = session.transcript;
    if (turnIdx >= turns.length) {
      stopAudio();
      return;
    }

    // Find next turn with real audio recording
    let targetIdx = turnIdx;
    while (targetIdx < turns.length && !turns[targetIdx].audioUrl) {
      targetIdx++;
    }

    if (targetIdx >= turns.length) {
      stopAudio();
      return;
    }

    playlistIndexRef.current = targetIdx;
    const turn = turns[targetIdx];
    setPlayingTurnId(turn.id);
    setPlaybackProgress(targetIdx / Math.max(1, turns.length));

    const cleanAudioUrl = withCacheBust(turn.audioUrl);

    if (cleanAudioUrl && typeof window !== 'undefined') {
      const audio = new Audio(cleanAudioUrl);
      audio.playbackRate = playbackSpeed;

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setCurrentTimeSeconds(Math.round(audio.currentTime));
        }
      };

      audio.onended = () => {
        if (isPlaylistModeRef.current) {
          playTurnInSequence(session, targetIdx + 1);
        } else {
          stopAudio();
        }
      };

      audio.onerror = () => {
        if (isPlaylistModeRef.current) {
          playTurnInSequence(session, targetIdx + 1);
        } else {
          stopAudio();
        }
      };

      activeAudioRef.current = audio;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        if (isPlaylistModeRef.current) {
          playTurnInSequence(session, targetIdx + 1);
        } else {
          stopAudio();
        }
      });
    } else if (isPlaylistModeRef.current) {
      playTurnInSequence(session, targetIdx + 1);
    } else {
      stopAudio();
    }
  };

  // Full Session Playback Toggle (Maya -> You -> Maya -> You in proper order)
  const togglePlay = (targetSession?: HistorySession) => {
    const session = targetSession || activeSession;
    if (!session) return;

    // If currently playing this session -> pause it
    if (isPlaying && activeAudioSessionIdRef.current === session.id) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
        } catch {}
      }
      setIsPlaying(false);
      return;
    }

    // If playing a different session -> stop previous first
    if (activeAudioRef.current && activeAudioSessionIdRef.current !== session.id) {
      stopAudio();
    }

    // If resuming after pause on the same session (single audio element)
    if (activeAudioRef.current && activeAudioSessionIdRef.current === session.id && !isPlaylistModeRef.current) {
      activeAudioRef.current.playbackRate = playbackSpeed;
      activeAudioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Audio resume error:', e);
        setIsPlaying(false);
      });
      return;
    }

    // If resuming playlist mode after pause
    if (isPlaylistModeRef.current && activeAudioSessionIdRef.current === session.id && playlistIndexRef.current >= 0) {
      playTurnInSequence(session, playlistIndexRef.current);
      return;
    }

    // Priority 1: Full conversation audio URL (Maya & User stitched in proper chronological order)
    const baseUrl = getBackendBaseUrl();
    const rawFullAudioUrl = session.fullConversationAudioUrl || (session.id ? `${baseUrl}/v1/sessions/${session.id}/recording-audio?type=full` : '');
    const fullAudioUrl = withCacheBust(rawFullAudioUrl);

    if (fullAudioUrl && typeof window !== 'undefined') {
      try {
        const audio = new Audio(fullAudioUrl);
        audio.playbackRate = playbackSpeed;

        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            setPlaybackProgress(audio.currentTime / audio.duration);
            setCurrentTimeSeconds(Math.round(audio.currentTime));
            setTotalDurationSeconds(Math.round(audio.duration));
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setPlaybackProgress(0);
          setCurrentTimeSeconds(0);
          setPlayingTurnId(null);
        };

        audio.onerror = () => {
          console.log('[History] full_conversation.wav failed to load, falling back to sequential turn playlist');
          isPlaylistModeRef.current = true;
          activeAudioSessionIdRef.current = session.id;
          setIsPlaying(true);
          playTurnInSequence(session, 0);
        };

        activeAudioRef.current = audio;
        activeAudioSessionIdRef.current = session.id;
        isPlaylistModeRef.current = false;

        audio.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          isPlaylistModeRef.current = true;
          activeAudioSessionIdRef.current = session.id;
          setIsPlaying(true);
          playTurnInSequence(session, 0);
        });
        return;
      } catch (err) {
        console.warn('[History] Error starting full conversation audio:', err);
      }
    }

    // Priority 2: Fallback to Sequential Turn Playlist in proper order
    if (session.transcript && session.transcript.some(t => t.audioUrl)) {
      isPlaylistModeRef.current = true;
      activeAudioSessionIdRef.current = session.id;
      setIsPlaying(true);
      playTurnInSequence(session, 0);
      return;
    }

    // Priority 3: Fallback to userAudioUrl or modelAudioUrl if available
    const fallbackUrl = (session.userAudioUrl || session.modelAudioUrl || (session.id ? `${baseUrl}/v1/sessions/${session.id}/recording-audio?type=user` : '')).replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
    if (fallbackUrl && typeof window !== 'undefined') {
      try {
        const audio = new Audio(fallbackUrl);
        audio.playbackRate = playbackSpeed;
        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            setPlaybackProgress(audio.currentTime / audio.duration);
            setCurrentTimeSeconds(Math.round(audio.currentTime));
            setTotalDurationSeconds(Math.round(audio.duration));
          }
        };
        audio.onended = () => {
          setIsPlaying(false);
          setPlaybackProgress(0);
          setCurrentTimeSeconds(0);
        };
        activeAudioRef.current = audio;
        activeAudioSessionIdRef.current = session.id;
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } catch {}
    }
  };

  const handleCardTogglePlay = useCallback((e: any, item: HistorySession) => {
    e.stopPropagation?.();
    setSelectedSessionId(item.id);
    startTransition(() => {
      setDetailSessionId(item.id);
    });
    togglePlay(item);
  }, [togglePlay]);

  // Play individual turn audio (You or Maya) - REAL RECORDED AUDIO ONLY
  const togglePlayTurn = (turn: TranscriptTurn, session: HistorySession) => {
    // If currently playing this exact turn -> pause/stop
    if (playingTurnId === turn.id) {
      stopAudio();
      return;
    }

    // Stop previous audio
    stopAudio();

    const baseUrl = getBackendBaseUrl();
    const rawTurnUrl = turn.audioUrl || (session.id ? `${baseUrl}/v1/sessions/${session.id}/recording-audio?type=turn&speaker=${turn.speaker === 'user' ? 'user' : 'model'}&index=${turn.id || 0}` : '');
    const turnAudioUrl = rawTurnUrl.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
    if (!turnAudioUrl || typeof window !== 'undefined' && !window.Audio) {
      console.warn('[History] No audio recording clip available for turn', turn.id);
      return;
    }

    activeAudioSessionIdRef.current = session.id;
    setPlayingTurnId(turn.id);
    setIsPlaying(true);

    const playUrl = withCacheBust(turnAudioUrl);
    const audio = new Audio(playUrl);
    audio.playbackRate = playbackSpeed;

    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setPlaybackProgress(audio.currentTime / audio.duration);
        setCurrentTimeSeconds(Math.round(audio.currentTime));
        setTotalDurationSeconds(Math.round(audio.duration));
      }
    };

    audio.onended = () => {
      setPlayingTurnId(null);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setCurrentTimeSeconds(0);
    };

    audio.onerror = () => {
      console.warn('[History] Failed to load turn audio clip:', turnAudioUrl);
      setPlayingTurnId(null);
      setIsPlaying(false);
    };

    activeAudioRef.current = audio;
    audio.play().catch((err) => {
      console.warn('[History] Playback error on turn audio:', err);
      setPlayingTurnId(null);
      setIsPlaying(false);
    });
  };

  // Speed Toggle: 1.0x -> 1.25x -> 1.5x -> 2.0x -> 1.0x
  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (activeAudioRef.current) {
      activeAudioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (fraction: number) => {
    setPlaybackProgress(fraction);
    if (activeAudioRef.current && activeAudioRef.current.duration && !isNaN(activeAudioRef.current.duration)) {
      const newTime = fraction * activeAudioRef.current.duration;
      activeAudioRef.current.currentTime = newTime;
      setCurrentTimeSeconds(Math.round(newTime));
    } else if (isPlaylistModeRef.current && activeSession?.transcript) {
      const targetIdx = Math.floor(fraction * activeSession.transcript.length);
      playTurnInSequence(activeSession, Math.min(targetIdx, activeSession.transcript.length - 1));
    } else if (totalDurationSeconds > 0) {
      setCurrentTimeSeconds(Math.round(fraction * totalDurationSeconds));
    }
  };

  // Toggle single correction accordion
  const toggleCorrectionCollapse = (corrId: string) => {
    setCollapsedCorrections((prev) => ({
      ...prev,
      [corrId]: !prev[corrId],
    }));
  };

  // Jump to Next Correction
  const handleJumpToNextCorrection = () => {
    if (!activeSession) return;
    const correctionTurns = activeSession.transcript.filter((t) => t.correction);
    if (correctionTurns.length === 0) return;

    const nextIndex =
      (lastCorrectionIndexScrolled.current + 1) % correctionTurns.length;
    lastCorrectionIndexScrolled.current = nextIndex;
    const targetTurn = correctionTurns[nextIndex];

    const yPos = correctionPositions.current[targetTurn.id];
    if (yPos !== undefined && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTo({ y: Math.max(0, yPos - 20), animated: true });
    }
  };

  // Mode Filter Options
  const MODES_LIST: { id: PracticeMode; label: string }[] = [
    { id: 'all', label: 'All Modes' },
    { id: 'workplace', label: 'Workplace' },
    { id: 'casual', label: 'Casual Chat' },
    { id: 'interview', label: 'Job Interview' },
    { id: 'phone', label: 'Phone Call' },
    { id: 'travel', label: 'Travel English' },
  ];

  // Helper to render session detail view (shared between Desktop Right Column and Mobile Active View)
  const renderSessionDetailContent = () => {
    if (!activeSession) return null;

    return (
      <ScrollView
        ref={transcriptScrollRef}
        style={styles.detailScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.detailScrollContent}
      >
        {/* Session Header Box */}
        <View style={styles.detailHeaderBox}>
          <View style={styles.detailHeaderLeft}>
            <View
              style={[
                styles.detailModeSquare,
                { backgroundColor: getModeBadgeBg(activeSession.mode) },
              ]}
            >
              {renderModeIcon(activeSession.mode, 24)}
            </View>
            <View style={styles.detailHeaderTextGroup}>
              <Text style={styles.detailSessionTitle}>
                {activeSession.title}
              </Text>
              <View style={styles.detailMetaRow}>
                <View style={styles.metaItem}>
                  <CalendarSmallIcon color="#94A3B8" size={12} />
                  <Text style={styles.metaText}>{activeSession.dateString}</Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.metaItem}>
                  <ClockSmallIcon color="#94A3B8" size={12} />
                  <Text style={styles.metaText}>{activeSession.timeString}</Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.metaItem}>
                  <TimerSmallIcon color="#94A3B8" size={12} />
                  <Text style={styles.metaText}>{activeSession.durationString}</Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.metaItem}>
                  <RefreshCorrectionsIcon color="#94A3B8" size={12} />
                  <Text style={styles.metaText}>
                    {activeSession.correctionsCount} corrections
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.closeDetailButton}
            hitSlop={10}
            onPress={() => setSelectedSessionId(null)}
          >
            <CloseCrossIcon size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* ── VOICE RECORDING SECTION ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Voice Recording</Text>
          <View style={styles.voiceRecordingCard}>
            {hasActiveRecording ? (
              <View style={styles.voicePlayerRow}>
                {/* Play/Pause Button */}
                <Pressable
                  style={styles.voicePlayButton}
                  onPress={() => togglePlay()}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause recording' : 'Play recording'}
                >
                  {isPlaying ? (
                    <HistoryPauseIcon size={44} color="#2B5BFF" />
                  ) : (
                    <HistoryPlayIcon size={44} color="#2B5BFF" />
                  )}
                </Pressable>

                {/* Waveform Visualizer */}
                <View style={styles.waveformContainer}>
                  {waveformBars.map((barHeight, idx) => {
                    const fraction = idx / waveformBars.length;
                    const isPlayed = fraction <= playbackProgress;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => handleSeek(fraction)}
                        hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
                        style={styles.waveformBarTouch}
                        accessibilityRole="button"
                        accessibilityLabel={`Seek to ${Math.round(fraction * 100)}%`}
                      >
                        <View
                          style={[
                            styles.waveformBar,
                            {
                              height: barHeight,
                              backgroundColor: isPlayed ? '#2B5BFF' : '#CBD5E1',
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                {/* Time & Speed Controls */}
                <Text style={styles.voiceDurationText}>
                  {isPlaying || currentTimeSeconds > 0
                    ? `${formatAudioTime(currentTimeSeconds)} / ${formatAudioTime(totalDurationSeconds || activeSession.durationSeconds || 17)}`
                    : activeSession.recordingLengthString || formatAudioTime(totalDurationSeconds || 17)}
                </Text>
                <Pressable
                  style={styles.speedPill}
                  onPress={cyclePlaybackSpeed}
                  accessibilityRole="button"
                  accessibilityLabel={`Change speed: current ${playbackSpeed.toFixed(1)}x`}
                >
                  <Text style={styles.speedPillText}>
                    {playbackSpeed.toFixed(1)}x
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Recording Not Available State */
              <View style={styles.noRecordingRow}>
                <View style={styles.noRecordingIconCircle}>
                  <Ionicons name="mic-off-outline" size={22} color="#64748B" />
                </View>
                <View style={styles.noRecordingTextCol}>
                  <View style={styles.noRecordingHeadingRow}>
                    <Text style={styles.noRecordingTitle}>Recording Not Available</Text>
                    <View style={styles.noRecordingExpiredTag}>
                      <Text style={styles.noRecordingExpiredTagText}>7-Day Retention</Text>
                    </View>
                  </View>
                  <Text style={styles.noRecordingSubtitle}>
                    Voice audio is retained for 7 days in accordance with privacy rules. The complete transcript, grammar analysis, and corrections are permanently saved below.
                  </Text>
                </View>
                <View style={styles.noRecordingDurationBadge}>
                  <Ionicons name="time-outline" size={13} color="#64748B" />
                  <Text style={styles.noRecordingBadgeText}>{activeSession.durationString}</Text>
                </View>
              </View>
            )}

            {/* Auto-remove notice */}
            <View style={styles.recordingNoticeRow}>
              <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
              <Text style={styles.noticeText}>
                {hasActiveRecording
                  ? 'This recording will be automatically removed within 7 days in accordance with privacy rules.'
                  : 'Audio recordings expire after 7 days. Text transcripts and AI suggestions are saved permanently.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── SESSION TRANSCRIPT SECTION ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.transcriptSectionHeader}>
            <Text style={styles.sectionHeaderTitle}>Session Transcript</Text>
            {Boolean(activeSession.correctionsCount > 0 || (activeSession.transcript && activeSession.transcript.some((t) => Boolean(t.correction)))) && (
              <Pressable
                style={styles.jumpCorrectionButton}
                onPress={handleJumpToNextCorrection}
                accessibilityRole="button"
                accessibilityLabel="Jump to next grammar correction"
              >
                <NextCorrectionIcon color="#0057FF" size={13} />
                <Text style={styles.jumpCorrectionText}>
                  Jump to Next Correction
                </Text>
              </Pressable>
            )}
          </View>

          {/* Transcript turns */}
          <View style={styles.transcriptList}>
            {activeSession.transcript.map((turn) => {
              const isUser = turn.speaker === 'user';
              return (
                <View
                  key={turn.id}
                  style={styles.turnRow}
                  onLayout={(e) => {
                    correctionPositions.current[turn.id] =
                      e.nativeEvent.layout.y;
                  }}
                >
                  {/* Avatar */}
                  <View
                    style={[
                      styles.turnAvatarCircle,
                      isUser
                        ? styles.userAvatarCircle
                        : styles.aiAvatarCircle,
                    ]}
                  >
                    {isUser ? (
                      <ModeUserAvatarIcon size={16} color="#64748B" />
                    ) : (
                      renderModeIcon(activeSession.mode, 16)
                    )}
                  </View>

                  {/* Turn Content */}
                  <View style={styles.turnContentCol}>
                    <View style={styles.speakerHeaderRow}>
                      <View style={styles.speakerNameCol}>
                        <Text style={styles.speakerNameText}>
                          {isUser ? 'You' : 'AI'}
                        </Text>
                        <Text style={styles.speakerTimeText}>{turn.time}</Text>
                      </View>
                      {Boolean(turn.audioUrl) && (
                        <Pressable
                          style={[
                            styles.turnPlayButton,
                            playingTurnId === turn.id && styles.turnPlayButtonActive,
                          ]}
                          onPress={() => togglePlayTurn(turn, activeSession)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Play ${isUser ? 'your' : 'AI'} audio turn`}
                        >
                          {playingTurnId === turn.id ? (
                            <Ionicons name="pause" size={12} color="#2B5BFF" />
                          ) : (
                            <Ionicons name="volume-medium" size={13} color="#64748B" />
                          )}
                          <Text
                            style={[
                              styles.turnPlayText,
                              playingTurnId === turn.id && styles.turnPlayTextActive,
                            ]}
                          >
                            {playingTurnId === turn.id ? 'Playing' : 'Listen'}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Message Bubble */}
                    <View
                      style={[
                        styles.turnBubble,
                        isUser
                          ? styles.userTurnBubble
                          : styles.aiTurnBubble,
                        playingTurnId === turn.id && styles.turnBubblePlaying,
                      ]}
                    >
                      <Text style={styles.turnBubbleText}>{turn.message}</Text>
                    </View>

                    {turn.correction && (
                      <View style={styles.correctionCard}>
                        <Pressable
                          style={styles.correctionHeaderRow}
                          onPress={() =>
                            toggleCorrectionCollapse(turn.correction!.id)
                          }
                        >
                          <View style={styles.correctionTitleLeft}>
                            <View style={styles.redCrossCircle}>
                              <Text style={styles.redCrossMark}>✕</Text>
                            </View>
                            <Text style={styles.correctionCountText}>
                              {turn.correction.countText}
                            </Text>
                            <Text style={styles.correctionChevron}>
                              {collapsedCorrections[turn.correction.id]
                                ? '∨'
                                : '∧'}
                            </Text>
                          </View>

                          <View style={styles.correctionHeaderRight}>
                            {Boolean(turn.audioUrl || activeSession.fullConversationAudioUrl) && (
                              <Pressable
                                style={styles.audioSpeakerButton}
                                onPress={() => {
                                  if (turn.audioUrl) {
                                    togglePlayTurn(turn, activeSession);
                                  } else {
                                    togglePlay(activeSession);
                                  }
                                }}
                                hitSlop={6}
                              >
                                <VolumeSpeakerIcon color="#94A3B8" size={16} />
                              </Pressable>
                            )}
                            <Image
                              source={require('@/assets/images/maya-avatar.png')}
                              style={styles.miniMayaAvatar}
                            />
                          </View>
                        </Pressable>

                        {!collapsedCorrections[turn.correction.id] && (
                          <View style={styles.correctionBody}>
                            <View style={styles.comparisonBoxesRow}>
                              <View style={styles.originalPhraseBox}>
                                <View style={styles.phraseLine}>
                                  <Text style={styles.phraseCross}>✕ </Text>
                                  <Text style={styles.originalStrikethroughText}>
                                    {turn.correction.originalText}
                                  </Text>
                                </View>
                                <Text style={styles.phraseLabel}>Original</Text>
                              </View>

                              <Text style={styles.comparisonArrow}>→</Text>

                              <View style={styles.correctedPhraseBox}>
                                <View style={styles.phraseLine}>
                                  <Text style={styles.phraseCheck}>✓ </Text>
                                  <Text style={styles.correctedGreenText}>
                                    {turn.correction.correctedText}
                                  </Text>
                                </View>
                                <Text style={styles.phraseLabel}>Corrected</Text>
                              </View>
                            </View>

                            <View style={styles.whyExplanationRow}>
                              <Text style={styles.whyPrefix}>Why: </Text>
                              <Text style={styles.whyExplanationText}>
                                {turn.correction.whyExplanation}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* ================================================================== */}
        {/* DESKTOP SIDEBAR NAVIGATION */}
        {/* ================================================================== */}
        {isDesktop && (
          <DesktopSidebar
            activeTab="history"
            onSelectTab={handleSelectTab}
            isPro={isPro}
            planTier={stats.planTier}
            isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
            usedMinutes={stats.usedMinutes}
            totalMinutes={stats.totalMinutes}
            resetsInText={stats.resetsInText}
            onUpgrade={() => router.push('/upgrade')}
            onReactivate={() => router.push('/(tabs)/account')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* ================================================================== */}
        {/* MAIN CONTAINER */}
        {/* ================================================================== */}
        <View style={styles.mainContainer}>
          {/* ============================================================== */}
          {/* TOP BAR */}
          {/* ============================================================== */}
          {!isDesktop ? (
            <MobileTopBar
              pinned
              onLevelPress={() => setActivePopup('level-up')}
            />
          ) : (
            // Desktop Top Right Level Badge Header
            <View style={styles.desktopTopHeader}>
              <View style={{ flex: 1 }} />
              <UserLevelBadge
                levelLabel={stats.levelLabel}
                xpLabel={stats.xpLabel}
                progress={stats.progress}
                isPro={isPro}
                planTier={stats.planTier}
                isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
                avatarSource={require('@/assets/images/maya-avatar.png')}
                onPress={() => setActivePopup('level-up')}
              />
            </View>
          )}

          {/* ============================================================== */}
          {/* CONTENT AREA: RESPONSIVE MASTER-DETAIL OR MOBILE LIST/DETAIL */}
          {/* ============================================================== */}
          {isDesktop ? (
            // ─── DESKTOP MASTER-DETAIL LAYOUT ─────────────────────────────
            <View style={styles.desktopMasterDetailContainer}>
              {/* Desktop Header */}
              <View style={styles.desktopTitleSection}>
                <Text style={styles.screenMainTitle}>History</Text>
                <Text style={styles.screenSubtitle}>
                  Review your past conversations and continue your journey.
                </Text>
              </View>

              {/* Master Detail Split */}
              <View style={styles.desktopColumnsRow}>
                {/* ── LEFT COLUMN: SEARCH & SESSION LIST ── */}
                <View style={styles.desktopListColumn}>
                  {/* Search bar */}
                  <View style={styles.searchBarContainer}>
                    <SearchIcon color="#94A3B8" size={18} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search conversations..."
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                        <CloseCrossIcon size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>

                  {/* Grouped Sessions Scroll */}
                  <ScrollView
                    style={styles.desktopSessionsScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.desktopSessionsScrollContent}
                  >
                    {isLoading ? (
                      <View style={styles.skeletonContainer}>
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <View key={idx} style={styles.skeletonCard}>
                            <View style={styles.skeletonIconBox} />
                            <View style={styles.skeletonInfoCol}>
                              <View style={styles.skeletonTitleBar} />
                              <View style={styles.skeletonMetaBar} />
                            </View>
                            <View style={styles.skeletonPlayCircle} />
                          </View>
                        ))}
                      </View>
                    ) : Object.keys(groupedSessions).length === 0 ? (
                      <View style={styles.emptyResultsBox}>
                        <Text style={styles.emptyResultsText}>
                          No conversations found matching your search.
                        </Text>
                      </View>
                    ) : (
                      Object.entries(groupedSessions).map(([groupTitle, sessions]) => (
                        <View key={groupTitle} style={styles.groupContainer}>
                          <Text style={styles.groupHeaderTitle}>{groupTitle}</Text>
                          {sessions.map((item) => (
                            <DesktopSessionCard
                              key={item.id}
                              item={item}
                              isSelected={item.id === (selectedSessionId || activeSession?.id)}
                              onSelect={handleSelectSession}
                              onTogglePlay={handleCardTogglePlay}
                              isPlayingThisSession={item.id === activeAudioSessionIdRef.current && isPlaying}
                              isAudioUnreachable={Boolean(
                                (item.fullConversationAudioUrl && unreachableAudioUrls.has(item.fullConversationAudioUrl)) ||
                                (item.userAudioUrl && unreachableAudioUrls.has(item.userAudioUrl)) ||
                                (item.modelAudioUrl && unreachableAudioUrls.has(item.modelAudioUrl))
                              )}
                            />
                          ))}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>

                {/* ── RIGHT COLUMN: SELECTED SESSION DETAIL ── */}
                <View style={styles.desktopDetailColumn}>
                  {isLoading ? (
                    <HistoryDetailSkeleton />
                  ) : activeSession ? (
                    <ScrollView
                      key={activeSession.id}
                      ref={transcriptScrollRef}
                      style={[
                        styles.detailScroll,
                        Platform.OS === 'web' && ({
                          animation: 'historyDetailFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                        } as any),
                      ]}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.detailScrollContent}
                    >
                      {/* Session Header Box */}
                      <View style={styles.detailHeaderBox}>
                        <View style={styles.detailHeaderLeft}>
                          <View
                            style={[
                              styles.detailModeSquare,
                              { backgroundColor: getModeBadgeBg(activeSession.mode) },
                            ]}
                          >
                            {renderModeIcon(activeSession.mode, 24)}
                          </View>
                          <View style={styles.detailHeaderTextGroup}>
                            <Text style={styles.detailSessionTitle}>
                              {activeSession.title}
                            </Text>
                            <View style={styles.detailMetaRow}>
                              <View style={styles.metaItem}>
                                <CalendarSmallIcon color="#94A3B8" size={12} />
                                <Text style={styles.metaText}>{activeSession.dateString}</Text>
                              </View>
                              <Text style={styles.metaDot}>•</Text>
                              <View style={styles.metaItem}>
                                <ClockSmallIcon color="#94A3B8" size={12} />
                                <Text style={styles.metaText}>{activeSession.timeString}</Text>
                              </View>
                              <Text style={styles.metaDot}>•</Text>
                              <View style={styles.metaItem}>
                                <TimerSmallIcon color="#94A3B8" size={12} />
                                <Text style={styles.metaText}>{activeSession.durationString}</Text>
                              </View>
                              <Text style={styles.metaDot}>•</Text>
                              <View style={styles.metaItem}>
                                <RefreshCorrectionsIcon color="#94A3B8" size={12} />
                                <Text style={styles.metaText}>
                                  {activeSession.correctionsCount} corrections
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <Pressable style={styles.closeDetailButton} hitSlop={10}>
                          <CloseCrossIcon size={18} color="#94A3B8" />
                        </Pressable>
                      </View>

                      {/* ── VOICE RECORDING SECTION ── */}
                      <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeaderTitle}>Voice Recording</Text>
                        <View style={styles.voiceRecordingCard}>
                          {hasActiveRecording ? (
                            <View style={styles.voicePlayerRow}>
                              {/* Play/Pause Button */}
                              <Pressable style={styles.voicePlayButton} onPress={() => togglePlay()}>
                                {isPlaying ? (
                                  <HistoryPauseIcon size={44} color="#2B5BFF" />
                                ) : (
                                  <HistoryPlayIcon size={44} color="#2B5BFF" />
                                )}
                              </Pressable>

                              {/* Waveform Visualizer */}
                              <View style={styles.waveformContainer}>
                                {waveformBars.map((barHeight, idx) => {
                                  const fraction = idx / waveformBars.length;
                                  const isPlayed = fraction <= playbackProgress;
                                  return (
                                    <Pressable
                                      key={idx}
                                      onPress={() => handleSeek(fraction)}
                                      hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
                                      style={styles.waveformBarTouch}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Seek to ${Math.round(fraction * 100)}%`}
                                    >
                                      <View
                                        style={[
                                          styles.waveformBar,
                                          {
                                            height: barHeight,
                                            backgroundColor: isPlayed ? '#2B5BFF' : '#CBD5E1',
                                          },
                                        ]}
                                      />
                                    </Pressable>
                                  );
                                })}
                              </View>

                              {/* Time & Speed Controls */}
                              <Text style={styles.voiceDurationText}>
                                {isPlaying || currentTimeSeconds > 0
                                  ? `${formatAudioTime(currentTimeSeconds)} / ${formatAudioTime(totalDurationSeconds || activeSession.durationSeconds || 17)}`
                                  : activeSession.recordingLengthString || formatAudioTime(totalDurationSeconds || 17)}
                              </Text>
                              <Pressable
                                style={styles.speedPill}
                                onPress={cyclePlaybackSpeed}
                              >
                                <Text style={styles.speedPillText}>
                                  {playbackSpeed.toFixed(1)}x
                                </Text>
                              </Pressable>
                            </View>
                          ) : (
                            /* Recording Not Available State */
                            <View style={styles.noRecordingRow}>
                              <View style={styles.noRecordingIconCircle}>
                                <Ionicons name="mic-off-outline" size={20} color="#94A3B8" />
                              </View>
                              <View style={styles.noRecordingTextCol}>
                                <Text style={styles.noRecordingTitle}>Recording Not Available</Text>
                                <Text style={styles.noRecordingSubtitle}>
                                  Voice recording is not stored for this session or was removed after the 7-day retention period. Text transcript is saved below.
                                </Text>
                              </View>
                              <View style={styles.noRecordingBadge}>
                                <Text style={styles.noRecordingBadgeText}>{activeSession.durationString}</Text>
                              </View>
                            </View>
                          )}

                          {/* Auto-remove notice */}
                          <View style={styles.recordingNoticeRow}>
                            <Text style={styles.noticeIconCircle}>ⓘ</Text>
                            <Text style={styles.noticeText}>
                              {hasActiveRecording
                                ? 'This recording will be automatically removed within 7 days in accordance with privacy rules.'
                                : 'Audio recordings expire after 7 days. Text transcripts and AI suggestions are saved permanently.'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* ── SESSION TRANSCRIPT SECTION ── */}
                      <View style={styles.sectionContainer}>
                        <View style={styles.transcriptSectionHeader}>
                          <Text style={styles.sectionHeaderTitle}>Session Transcript</Text>
                          {Boolean(activeSession.correctionsCount > 0 || (activeSession.transcript && activeSession.transcript.some((t) => Boolean(t.correction)))) && (
                            <Pressable
                              style={styles.jumpCorrectionButton}
                              onPress={handleJumpToNextCorrection}
                              accessibilityRole="button"
                              accessibilityLabel="Jump to next grammar correction"
                            >
                              <NextCorrectionIcon color="#0057FF" size={13} />
                              <Text style={styles.jumpCorrectionText}>
                                Jump to Next Correction
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Transcript turns */}
                        <View style={styles.transcriptList}>
                          {activeSession.transcript.map((turn) => {
                            const isUser = turn.speaker === 'user';
                            return (
                              <View
                                key={turn.id}
                                style={styles.turnRow}
                                onLayout={(e) => {
                                  correctionPositions.current[turn.id] =
                                    e.nativeEvent.layout.y;
                                }}
                              >
                                {/* Avatar */}
                                <View
                                  style={[
                                    styles.turnAvatarCircle,
                                    isUser
                                      ? styles.userAvatarCircle
                                      : styles.aiAvatarCircle,
                                  ]}
                                >
                                  {isUser ? (
                                    <ModeUserAvatarIcon size={16} color="#64748B" />
                                  ) : (
                                    renderModeIcon(activeSession.mode, 16)
                                  )}
                                </View>

                                {/* Turn Content */}
                                <View style={styles.turnContentCol}>
                                  {/* Speaker Name, Time & Audio Play Button */}
                                  <View style={styles.speakerHeaderRow}>
                                    <View style={styles.speakerHeaderLeft}>
                                      <Text style={styles.speakerNameText}>
                                        {isUser ? 'You' : 'AI'}
                                      </Text>
                                      <Text style={styles.speakerTimeText}>{turn.time}</Text>
                                    </View>
                                    {Boolean(hasActiveRecording && turn.audioUrl && !unreachableAudioUrls.has(turn.audioUrl)) && (
                                      <Pressable
                                        style={[
                                          styles.turnPlayButton,
                                          playingTurnId === turn.id && styles.turnPlayButtonActive,
                                        ]}
                                        onPress={() => togglePlayTurn(turn, activeSession)}
                                        hitSlop={8}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Play ${isUser ? 'your' : 'AI'} audio turn`}
                                      >
                                        {playingTurnId === turn.id ? (
                                          <Ionicons name="pause" size={12} color="#2B5BFF" />
                                        ) : (
                                          <Ionicons name="volume-medium" size={13} color="#64748B" />
                                        )}
                                        <Text
                                          style={[
                                            styles.turnPlayText,
                                            playingTurnId === turn.id && styles.turnPlayTextActive,
                                          ]}
                                        >
                                          {playingTurnId === turn.id ? 'Playing' : 'Listen'}
                                        </Text>
                                      </Pressable>
                                    )}
                                  </View>

                                  {/* Message Bubble */}
                                  <View
                                    style={[
                                      styles.turnBubble,
                                      isUser
                                        ? styles.userTurnBubble
                                        : styles.aiTurnBubble,
                                      playingTurnId === turn.id && styles.turnBubblePlaying,
                                    ]}
                                  >
                                    <Text style={styles.turnBubbleText}>{turn.message}</Text>
                                  </View>

                                  {/* Grammar Correction Box (if any) */}
                                  {turn.correction && (
                                    <View style={styles.correctionCard}>
                                      {/* Correction Header */}
                                      <Pressable
                                        style={styles.correctionHeaderRow}
                                        onPress={() =>
                                          toggleCorrectionCollapse(turn.correction!.id)
                                        }
                                      >
                                        <View style={styles.correctionTitleLeft}>
                                          <View style={styles.redCrossCircle}>
                                            <Text style={styles.redCrossMark}>✕</Text>
                                          </View>
                                          <Text style={styles.correctionCountText}>
                                            {turn.correction.countText}
                                          </Text>
                                          <Text style={styles.correctionChevron}>
                                            {collapsedCorrections[turn.correction.id]
                                              ? '∨'
                                              : '∧'}
                                          </Text>
                                        </View>

                                        <View style={styles.correctionHeaderRight}>
                                          {Boolean(hasActiveRecording && (turn.audioUrl || activeSession.fullConversationAudioUrl)) && (
                                            <Pressable
                                              style={styles.audioSpeakerButton}
                                              onPress={() => {
                                                if (turn.audioUrl) {
                                                  togglePlayTurn(turn, activeSession);
                                                } else {
                                                  togglePlay(activeSession);
                                                }
                                              }}
                                              hitSlop={6}
                                            >
                                              <VolumeSpeakerIcon color="#94A3B8" size={16} />
                                            </Pressable>
                                          )}
                                          <Image
                                            source={require('@/assets/images/maya-avatar.png')}
                                            style={styles.miniMayaAvatar}
                                          />
                                        </View>
                                      </Pressable>

                                      {/* Correction Body (Collapsible) */}
                                      {!collapsedCorrections[turn.correction.id] && (
                                        <View style={styles.correctionBody}>
                                          {/* Comparison boxes */}
                                          <View style={styles.comparisonBoxesRow}>
                                            {/* Original Box */}
                                            <View style={styles.originalPhraseBox}>
                                              <View style={styles.phraseLine}>
                                                <Text style={styles.phraseCross}>✕ </Text>
                                                <Text style={styles.originalStrikethroughText}>
                                                  {turn.correction.originalText}
                                                </Text>
                                              </View>
                                              <Text style={styles.phraseLabel}>Original</Text>
                                            </View>

                                            {/* Arrow */}
                                            <Text style={styles.comparisonArrow}>→</Text>

                                            {/* Corrected Box */}
                                            <View style={styles.correctedPhraseBox}>
                                              <View style={styles.phraseLine}>
                                                <Text style={styles.phraseCheck}>✓ </Text>
                                                <Text style={styles.correctedGreenText}>
                                                  {turn.correction.correctedText}
                                                </Text>
                                              </View>
                                              <Text style={styles.phraseLabel}>Corrected</Text>
                                            </View>
                                          </View>

                                          {/* Explanation Why */}
                                          <View style={styles.whyExplanationRow}>
                                            <Text style={styles.whyPrefix}>Why: </Text>
                                            <Text style={styles.whyExplanationText}>
                                              {turn.correction.whyExplanation}
                                            </Text>
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyDetailContainer}>
                      <Text style={styles.emptyDetailText}>
                        Select a conversation from the left to view recording and transcript.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            // ─── MOBILE VIEW: LIST VIEW OR DETAIL VIEW ────────────────────
            selectedSessionId && activeSession ? (
              // ── MOBILE DETAIL VIEW ──
              <View
                key={activeSession.id}
                style={[
                  styles.mobileDetailContainer,
                  Platform.OS === 'web' && ({
                    animation: 'historyDetailFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  } as any),
                ]}
              >
                {/* Mobile Sub-Header: Back Button, Mode Icon & Title */}
                <View style={styles.mobileDetailTopNav}>
                  <Pressable
                    style={styles.mobileBackButton}
                    onPress={() => handleSelectSession(null)}
                    hitSlop={10}
                  >
                    <ChevronLeftIcon size={20} color="#0F172A" />
                  </Pressable>

                  <View
                    style={[
                      styles.mobileDetailModeSquare,
                      { backgroundColor: getModeBadgeBg(activeSession.mode) },
                    ]}
                  >
                    {renderModeIcon(activeSession.mode, 20)}
                  </View>

                  <Text style={styles.mobileDetailTitle} numberOfLines={1}>
                    {activeSession.title}
                  </Text>

                  <Pressable style={styles.mobileMoreButton} hitSlop={10}>
                    <MoreVerticalIcon color="#94A3B8" size={18} />
                  </Pressable>
                </View>

                {/* Sub-meta line */}
                <View style={styles.mobileDetailMetaRow}>
                  <View style={styles.metaItem}>
                    <CalendarSmallIcon color="#94A3B8" size={12} />
                    <Text style={styles.metaText}>{activeSession.dateString}</Text>
                  </View>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.metaItem}>
                    <ClockSmallIcon color="#94A3B8" size={12} />
                    <Text style={styles.metaText}>{activeSession.timeString}</Text>
                  </View>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.metaItem}>
                    <TimerSmallIcon color="#94A3B8" size={12} />
                    <Text style={styles.metaText}>{activeSession.durationString}</Text>
                  </View>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.metaItem}>
                    <RefreshCorrectionsIcon color="#94A3B8" size={12} />
                    <Text style={styles.metaText}>
                      {activeSession.correctionsCount} corrections
                    </Text>
                  </View>
                </View>

                {/* Scrollable Detail Body */}
                <ScrollView
                  ref={transcriptScrollRef}
                  style={styles.mobileDetailScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.mobileDetailScrollContent}
                >
                  {/* Voice Recording */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeaderTitle}>Voice Recording</Text>
                    <View style={styles.voiceRecordingCard}>
                      {hasActiveRecording ? (
                        <View style={styles.voicePlayerRow}>
                          <Pressable style={styles.voicePlayButton} onPress={() => togglePlay()}>
                            {isPlaying ? (
                              <HistoryPauseIcon size={42} color="#2B5BFF" />
                            ) : (
                              <HistoryPlayIcon size={42} color="#2B5BFF" />
                            )}
                          </Pressable>

                          <View style={styles.waveformContainer}>
                            {waveformBars.slice(0, 32).map((barHeight, idx) => {
                              const fraction = idx / 32;
                              const isPlayed = fraction <= playbackProgress;
                              return (
                                <Pressable
                                  key={idx}
                                  onPress={() => handleSeek(fraction)}
                                  hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
                                  style={styles.waveformBarTouch}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Seek to ${Math.round(fraction * 100)}%`}
                                >
                                  <View
                                    style={[
                                      styles.waveformBar,
                                      {
                                        height: barHeight,
                                        backgroundColor: isPlayed ? '#2B5BFF' : '#CBD5E1',
                                      },
                                    ]}
                                  />
                                </Pressable>
                              );
                            })}
                          </View>

                          <Text style={styles.voiceDurationText}>
                            {isPlaying || currentTimeSeconds > 0
                              ? `${formatAudioTime(currentTimeSeconds)} / ${formatAudioTime(totalDurationSeconds || activeSession.durationSeconds || 17)}`
                              : activeSession.recordingLengthString || formatAudioTime(totalDurationSeconds || 17)}
                          </Text>
                          <Pressable
                            style={styles.speedPill}
                            onPress={cyclePlaybackSpeed}
                          >
                            <Text style={styles.speedPillText}>
                              {playbackSpeed.toFixed(1)}x
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        /* Recording Not Available State */
                        <View style={styles.noRecordingRow}>
                          <View style={styles.noRecordingIconCircle}>
                            <Ionicons name="mic-off-outline" size={20} color="#94A3B8" />
                          </View>
                          <View style={styles.noRecordingTextCol}>
                            <Text style={styles.noRecordingTitle}>Recording Not Available</Text>
                            <Text style={styles.noRecordingSubtitle}>
                              Voice recording is not stored for this session or was removed after the 7-day retention period. Text transcript is saved below.
                            </Text>
                          </View>
                          <View style={styles.noRecordingBadge}>
                            <Text style={styles.noRecordingBadgeText}>{activeSession.durationString}</Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.recordingNoticeRow}>
                        <Text style={styles.noticeIconCircle}>ⓘ</Text>
                        <Text style={styles.noticeText}>
                          {hasActiveRecording
                            ? 'This recording will be automatically removed within 7 days in accordance with privacy rules.'
                            : 'Audio recordings expire after 7 days. Text transcripts and AI suggestions are saved permanently.'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Session Transcript */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.transcriptSectionHeader}>
                      <Text style={styles.sectionHeaderTitle}>Session Transcript</Text>
                      {Boolean(activeSession.correctionsCount > 0 || (activeSession.transcript && activeSession.transcript.some((t) => Boolean(t.correction)))) && (
                        <Pressable
                          style={styles.jumpCorrectionButton}
                          onPress={handleJumpToNextCorrection}
                          accessibilityRole="button"
                          accessibilityLabel="Jump to next grammar correction"
                        >
                          <NextCorrectionIcon color="#0057FF" size={13} />
                          <Text style={styles.jumpCorrectionText}>
                            Jump to Next Correction
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Messages */}
                    <View style={styles.transcriptList}>
                      {activeSession.transcript.map((turn) => {
                        const isUser = turn.speaker === 'user';
                        return (
                          <View
                            key={turn.id}
                            style={styles.turnRow}
                            onLayout={(e) => {
                              correctionPositions.current[turn.id] =
                                e.nativeEvent.layout.y;
                            }}
                          >
                            <View
                              style={[
                                styles.turnAvatarCircle,
                                isUser
                                  ? styles.userAvatarCircle
                                  : styles.aiAvatarCircle,
                              ]}
                            >
                              {isUser ? (
                                <ModeUserAvatarIcon size={16} color="#64748B" />
                              ) : (
                                renderModeIcon(activeSession.mode, 16)
                              )}
                            </View>

                            <View style={styles.turnContentCol}>
                              {/* Speaker Name, Time & Audio Play Button */}
                              <View style={styles.speakerHeaderRow}>
                                <View style={styles.speakerHeaderLeft}>
                                  <Text style={styles.speakerNameText}>
                                    {isUser ? 'You' : 'AI'}
                                  </Text>
                                  <Text style={styles.speakerTimeText}>{turn.time}</Text>
                                </View>
                                {Boolean(hasActiveRecording && turn.audioUrl && !unreachableAudioUrls.has(turn.audioUrl)) && (
                                  <Pressable
                                    style={[
                                      styles.turnPlayButton,
                                      playingTurnId === turn.id && styles.turnPlayButtonActive,
                                    ]}
                                    onPress={() => togglePlayTurn(turn, activeSession)}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Play ${isUser ? 'your' : 'AI'} audio turn`}
                                  >
                                    {playingTurnId === turn.id ? (
                                      <Ionicons name="pause" size={12} color="#2B5BFF" />
                                    ) : (
                                      <Ionicons name="volume-medium" size={13} color="#64748B" />
                                    )}
                                    <Text
                                      style={[
                                        styles.turnPlayText,
                                        playingTurnId === turn.id && styles.turnPlayTextActive,
                                      ]}
                                    >
                                      {playingTurnId === turn.id ? 'Playing' : 'Listen'}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>

                              {/* Message Bubble */}
                              <View
                                style={[
                                  styles.turnBubble,
                                  isUser
                                    ? styles.userTurnBubble
                                    : styles.aiTurnBubble,
                                  playingTurnId === turn.id && styles.turnBubblePlaying,
                                ]}
                              >
                                <Text style={styles.turnBubbleText}>{turn.message}</Text>
                              </View>

                              {turn.correction && (
                                <View style={styles.correctionCard}>
                                  <Pressable
                                    style={styles.correctionHeaderRow}
                                    onPress={() =>
                                      toggleCorrectionCollapse(turn.correction!.id)
                                    }
                                  >
                                    <View style={styles.correctionTitleLeft}>
                                      <View style={styles.redCrossCircle}>
                                        <Text style={styles.redCrossMark}>✕</Text>
                                      </View>
                                      <Text style={styles.correctionCountText}>
                                        {turn.correction.countText}
                                      </Text>
                                      <Text style={styles.correctionChevron}>
                                        {collapsedCorrections[turn.correction.id]
                                          ? '∨'
                                          : '∧'}
                                      </Text>
                                    </View>

                                    <View style={styles.correctionHeaderRight}>
                                      {Boolean(hasActiveRecording && (turn.audioUrl || activeSession.fullConversationAudioUrl)) && (
                                        <Pressable
                                          style={styles.audioSpeakerButton}
                                          onPress={() => {
                                            if (turn.audioUrl) {
                                              togglePlayTurn(turn, activeSession);
                                            } else {
                                              togglePlay(activeSession);
                                            }
                                          }}
                                          hitSlop={6}
                                        >
                                          <VolumeSpeakerIcon color="#94A3B8" size={16} />
                                        </Pressable>
                                      )}
                                      <Image
                                        source={require('@/assets/images/maya-avatar.png')}
                                        style={styles.miniMayaAvatar}
                                      />
                                    </View>
                                  </Pressable>

                                  {!collapsedCorrections[turn.correction.id] && (
                                    <View style={styles.correctionBody}>
                                      <View style={styles.comparisonBoxesRow}>
                                        <View style={styles.originalPhraseBox}>
                                          <View style={styles.phraseLine}>
                                            <Text style={styles.phraseCross}>✕ </Text>
                                            <Text style={styles.originalStrikethroughText}>
                                              {turn.correction.originalText}
                                            </Text>
                                          </View>
                                          <Text style={styles.phraseLabel}>Original</Text>
                                        </View>

                                        <Text style={styles.comparisonArrow}>→</Text>

                                        <View style={styles.correctedPhraseBox}>
                                          <View style={styles.phraseLine}>
                                            <Text style={styles.phraseCheck}>✓ </Text>
                                            <Text style={styles.correctedGreenText}>
                                              {turn.correction.correctedText}
                                            </Text>
                                          </View>
                                          <Text style={styles.phraseLabel}>Corrected</Text>
                                        </View>
                                      </View>

                                      <View style={styles.whyExplanationRow}>
                                        <Text style={styles.whyPrefix}>Why: </Text>
                                        <Text style={styles.whyExplanationText}>
                                          {turn.correction.whyExplanation}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              </View>
            ) : (
              // ── MOBILE LIST VIEW ──
              <ScrollView
                style={styles.mobileListScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.mobileListScrollContent}
              >
                {/* Header */}
                <View style={styles.mobileTitleSection}>
                  <Text style={styles.screenMainTitle}>History</Text>
                  <Text style={styles.screenSubtitle}>
                    Review your past conversations and continue your journey.
                  </Text>
                </View>

                {/* Filters Row: Search input + All Modes Button */}
                <View style={styles.mobileFiltersRow}>
                  <View style={styles.mobileSearchContainer}>
                    <SearchIcon color="#94A3B8" size={18} />
                    <TextInput
                      style={styles.mobileSearchInput}
                      placeholder="Search conversations..."
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                        <CloseCrossIcon size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>

                  <Pressable
                    style={styles.mobileFilterButton}
                    onPress={() => setIsFilterModalOpen(true)}
                  >
                    <FilterLinesIcon color="#0F172A" size={16} />
                    <Text style={styles.mobileFilterButtonText}>
                      {MODES_LIST.find((m) => m.id === selectedMode)?.label || 'All Modes'}
                    </Text>
                  </Pressable>
                </View>

                {/* Grouped Sessions */}
                {isLoading ? (
                  <View style={styles.skeletonContainer}>
                    {[1, 2, 3, 4].map((idx) => (
                      <View key={idx} style={styles.skeletonCard}>
                        <View style={styles.skeletonIconBox} />
                        <View style={styles.skeletonInfoCol}>
                          <View style={styles.skeletonTitleBar} />
                          <View style={styles.skeletonMetaBar} />
                        </View>
                        <View style={styles.skeletonPlayCircle} />
                      </View>
                    ))}
                  </View>
                ) : Object.keys(groupedSessions).length === 0 ? (
                  <View style={styles.emptyResultsBox}>
                    <Text style={styles.emptyResultsText}>
                      No conversations found matching your search.
                    </Text>
                  </View>
                ) : (
                  Object.entries(groupedSessions).map(([groupTitle, sessions]) => (
                    <View key={groupTitle} style={styles.groupContainer}>
                      <Text style={styles.groupHeaderTitle}>{groupTitle}</Text>
                      {sessions.map((item) => (
                        <MobileSessionCard
                          key={item.id}
                          item={item}
                          isSelected={item.id === selectedSessionId}
                          onSelect={handleSelectSession}
                          onTogglePlay={handleCardTogglePlay}
                          isPlayingThisSession={item.id === activeAudioSessionIdRef.current && isPlaying}
                          isAudioUnreachable={Boolean(
                            (item.fullConversationAudioUrl && unreachableAudioUrls.has(item.fullConversationAudioUrl)) ||
                            (item.userAudioUrl && unreachableAudioUrls.has(item.userAudioUrl)) ||
                            (item.modelAudioUrl && unreachableAudioUrls.has(item.modelAudioUrl))
                          )}
                        />
                      ))}
                    </View>
                  ))
                )}
              </ScrollView>
            )
          )}


        </View>

        {/* ================================================================== */}
        {/* FILTER MODES MODAL (MOBILE) */}
        {/* ================================================================== */}
        <Modal
          visible={isFilterModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsFilterModalOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsFilterModalOpen(false)}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Filter by Mode</Text>
              {MODES_LIST.map((modeItem) => {
                const isSelected = selectedMode === modeItem.id;
                return (
                  <Pressable
                    key={modeItem.id}
                    style={[
                      styles.modalOptionRow,
                      isSelected && styles.modalOptionRowSelected,
                    ]}
                    onPress={() => {
                      setSelectedMode(modeItem.id);
                      setIsFilterModalOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {modeItem.label}
                    </Text>
                    {isSelected && <Text style={styles.modalOptionCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>

        {/* ================================================================== */}
        {/* COMMON POPUP (LEVEL UP / EXTRA TIME) */}
        {/* ================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'custom'}
          levelNumber={stats.currentLevelNumber}
          title={activePopup === 'level-up' ? 'Your Level Progress' : undefined}
          subtitle={
            activePopup === 'level-up'
              ? `You are currently on ${stats.levelLabel} with ${stats.xpLabel}.\nKeep practicing speaking lessons to reach Level ${stats.currentLevelNumber + 1}!`
              : undefined
          }
          primaryButtonText={activePopup === 'level-up' ? 'View Learning Roadmap' : undefined}
          primaryButtonIcon={activePopup === 'level-up' ? 'arrow' : undefined}
          showPrimaryArrow={activePopup === 'level-up' ? true : undefined}
          onClose={() => setActivePopup(null)}
          minutesUsed={stats.usedMinutes}
          minutesTotal={stats.totalMinutes}
          onPrimaryPress={() => {
            if (activePopup === 'level-up') {
              router.push('/(tabs)/roadmap');
            } else if (activePopup === 'get-extra-time' || activePopup === 'unlock-premium') {
              router.push('/upgrade');
            }
            setActivePopup(null);
          }}
          onFooterButtonPress={() => {
            router.push('/upgrade');
            setActivePopup(null);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { overflow: 'hidden', width: '100%' } : {}),
  },
  mainContainer: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
  },

  // ── Desktop Top Header ──
  desktopTopHeader: {
    height: 64,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  // ── Mobile Fixed Top Bar ──
  mobileFixedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandAccent: {
    color: '#2B5BFF',
  },
  brandTaglineMobile: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  // ── Desktop Master-Detail Layout ──
  desktopMasterDetailContainer: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 20,
    ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
  },
  desktopTitleSection: {
    marginBottom: 16,
  },
  screenMainTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 28,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    marginTop: 3,
  },
  desktopColumnsRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 24,
  },

  // ── Desktop Left List Column ──
  desktopListColumn: {
    width: 420,
    flexShrink: 0,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 20,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 16,
    marginHorizontal: 2,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  desktopSessionsScroll: {
    flex: 1,
  },
  desktopSessionsScrollContent: {
    paddingTop: 4,
    paddingHorizontal: 2,
    paddingBottom: 40,
  },

  // ── Group Container & Cards ──
  groupContainer: {
    marginBottom: 20,
  },
  groupHeaderTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }),
  },
  sessionCardHovered: {
    borderColor: '#CBD5E1',
    transform: [{ translateY: -2 }],
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
        }
      : {}),
  },
  sessionCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  sessionCardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 10px rgba(59, 130, 246, 0.12), 0 1px 2px rgba(0,0,0,0.02)',
        }
      : {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  modeIconSquareSelected: {
    transform: [{ scale: 1.05 }],
  },
  modeIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCardCenter: {
    flex: 1,
  },
  sessionCardTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 4,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
  },
  metaDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  sessionCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardPlayButton: {
    padding: 2,
  },
  cardMoreButton: {
    padding: 4,
  },

  // ── Desktop Right Detail Column ──
  desktopDetailColumn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingBottom: 40,
    paddingRight: 8,
  },
  detailHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 20,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  detailModeSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderTextGroup: {
    flex: 1,
  },
  detailSessionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 4,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  closeDetailButton: {
    padding: 6,
  },

  // ── Voice Recording Card ──
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
  },
  voiceRecordingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  voicePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voicePlayButton: {
    padding: 0,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    gap: 3,
    paddingHorizontal: 4,
  },
  waveformBarTouch: {
    flex: 1,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBar: {
    width: '100%',
    minWidth: 2.5,
    maxWidth: 5,
    borderRadius: 2,
  },
  voiceDurationText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 4,
    minWidth: 72,
    textAlign: 'right',
  },
  speedPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0F172A',
  },
  recordingNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  noticeIconCircle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  noticeText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94A3B8',
  },

  // ── Session Transcript Section ──
  transcriptSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jumpCorrectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  jumpCorrectionText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0057FF',
  },
  transcriptList: {
    gap: 16,
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  turnAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  userAvatarCircle: {
    backgroundColor: '#F1F5F9',
  },
  aiAvatarCircle: {
    backgroundColor: '#ECFDF5',
  },
  turnContentCol: {
    flex: 1,
  },
  speakerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speakerNameText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#0F172A',
  },
  speakerTimeText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94A3B8',
  },
  turnPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  turnPlayButtonActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  turnPlayText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748B',
  },
  turnPlayTextActive: {
    color: '#2B5BFF',
  },
  turnBubble: {
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  turnBubblePlaying: {
    borderColor: '#2B5BFF',
    borderWidth: 1.5,
    backgroundColor: '#F0F7FF',
  },
  userTurnBubble: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  aiTurnBubble: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  turnBubbleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 19,
  },

  // ── Grammar Correction Card ──
  correctionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  correctionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  correctionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redCrossCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redCrossMark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: -1,
  },
  correctionCountText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#E11D48',
  },
  correctionChevron: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 2,
  },
  correctionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioSpeakerButton: {
    padding: 4,
  },
  miniMayaAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  correctionBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFF1F2',
  },
  comparisonBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  originalPhraseBox: {
    flex: 1,
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    padding: 8,
  },
  phraseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  phraseCross: {
    fontSize: 11,
    color: '#E11D48',
    fontWeight: 'bold',
  },
  originalStrikethroughText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#E11D48',
    textDecorationLine: 'line-through',
  },
  phraseCheck: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: 'bold',
  },
  correctedGreenText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#16A34A',
  },
  phraseLabel: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#94A3B8',
  },
  comparisonArrow: {
    fontSize: 14,
    color: '#94A3B8',
  },
  correctedPhraseBox: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 8,
  },
  whyExplanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  whyPrefix: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#0F172A',
  },
  whyExplanationText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },

  // ── Mobile List Screen ──
  mobileListScroll: {
    flex: 1,
  },
  mobileListScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 80,
  },
  mobileTitleSection: {
    marginBottom: 16,
  },
  mobileFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  mobileSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  mobileSearchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  mobileFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    height: 42,
    gap: 6,
  },
  mobileFilterButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0F172A',
  },
  mobileSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }),
  },
  mobileSessionCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  mobileSessionCardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 10px rgba(59, 130, 246, 0.12), 0 1px 2px rgba(0,0,0,0.02)',
        }
      : {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  mobileCardMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },

  // ── Mobile Detail Screen ──
  mobileDetailContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mobileDetailTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  mobileBackButton: {
    padding: 4,
  },
  mobileDetailModeSquare: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDetailTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    flex: 1,
  },
  mobileMoreButton: {
    padding: 4,
  },
  mobileDetailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  mobileDetailScroll: {
    flex: 1,
  },
  mobileDetailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },



  // ── Empty State ──
  emptyResultsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyResultsText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptyDetailContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyDetailText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  modalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 16,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    marginBottom: 4,
  },
  modalOptionRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#334155',
  },
  modalOptionTextSelected: {
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  modalOptionCheck: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: 'bold',
  },

  // ── No Audio & Unavailable Recording Styles ──
  cardNoAudioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardNoAudioPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748B',
  },
  noRecordingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noRecordingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  noRecordingTextCol: {
    flex: 1,
  },
  noRecordingHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  noRecordingTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#1E293B',
  },
  noRecordingExpiredTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noRecordingExpiredTagText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#92400E',
  },
  noRecordingSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  noRecordingBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  noRecordingDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  noRecordingBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748B',
  },
  speakerNameCol: {
    flexDirection: 'column',
  },

  // ── Skeleton & Loading States ──
  skeletonContainer: {
    paddingVertical: 8,
    gap: 10,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  skeletonIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: '#F1F5F9',
  },
  skeletonInfoCol: {
    flex: 1,
    gap: 8,
  },
  skeletonTitleBar: {
    width: '65%',
    height: 14,
    borderRadius: Radii.sm,
    backgroundColor: '#E2E8F0',
  },
  skeletonMetaBar: {
    width: '45%',
    height: 10,
    borderRadius: Radii.sm,
    backgroundColor: '#F1F5F9',
  },
  skeletonPlayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
  },
  loadingStateTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingStateSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
