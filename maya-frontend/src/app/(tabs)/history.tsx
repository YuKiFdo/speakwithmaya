import React, { useState, useRef, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { fontStyle } from '@/theme/fonts';

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
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { fetchAllPracticeSessions } from '@/services/supabase';

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
  transcript: TranscriptTurn[];
  corrections?: CorrectionItem[];
  scores?: {
    overall: number;
    fluency: number;
    grammar: number;
    pronunciation: number;
  };
}


// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const WAVEFORM_HEIGHTS = [
  12, 18, 26, 32, 22, 16, 28, 36, 30, 24, 18, 34, 40, 28, 20, 32,
  24, 16, 26, 34, 22, 14, 28, 36, 30, 20, 16, 30, 38, 24, 18, 26,
  34, 20, 14, 24, 32, 28, 18, 12,
];



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

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name || 'Tharindu Fernando';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  // Navigation & Popups
  const [activeTab, setActiveTab] = useState<DashboardTab>('history');
  const [isPro, setIsPro] = useState(true);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<PracticeMode>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Selected session (defaults to null, auto-selected on load)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0.35); // 35% played by default matching design
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [collapsedCorrections, setCollapsedCorrections] = useState<Record<string, boolean>>({});

  // Transcript scroll ref for "Jump to Next Correction"
  const transcriptScrollRef = useRef<ScrollView>(null);
  const correctionPositions = useRef<{ [id: string]: number }>({});
  const lastCorrectionIndexScrolled = useRef<number>(-1);

  // Dynamic & cached practice sessions
  const [allSessions, setAllSessions] = useState<HistorySession[]>([]);


  // Synchronize desktop selection
  useEffect(() => {
    if (isDesktop && !selectedSessionId && allSessions.length > 0) {
      setSelectedSessionId(allSessions[0].id);
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
      if (records && records.length > 0) {
        const converted: HistorySession[] = records.map((r, idx) => {
          const d = new Date(r.start_time);
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
              dateGroup = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
          const turnsList: Array<{ role: 'user' | 'model'; text: string; timestamp?: string }> = [];
          for (const t of rawTurns) {
            const prev = turnsList[turnsList.length - 1];
            if (!prev || prev.role !== t.role || prev.text.trim() !== t.text.trim()) {
              turnsList.push(t);
            }
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
              const tDate = new Date(t.timestamp);
              if (!isNaN(tDate.getTime())) {
                turnTimeString = tDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
              correction: turnCorrections[i],
            };
          });


          // If no transcript turns were recorded but corrections exist, generate turn items from corrections
          if (transcript.length === 0 && unassignedCorrections.length > 0) {
            unassignedCorrections.forEach((c, idx) => {
              transcript.push({
                id: `turn-${r.id}-user-${idx}`,
                speaker: 'user',
                time: !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
                message: c.originalText,
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
                time: !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
                message: `Great speaking! Remember: ${c.whyExplanation}`,
              });
            });
          }

          // If still completely empty
          if (transcript.length === 0) {
            transcript.push({
              id: `turn-${r.id}-0`,
              speaker: 'ai',
              time: !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              message: 'Practice session completed successfully.',
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
              : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            timeString: isNaN(d.getTime())
              ? 'Just now'
              : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            durationString: `${durationMin} mins`,
            recordingLengthString,
            durationSeconds: r.duration_seconds || 60,
            correctionsCount: rawCorrections.length,
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

        setAllSessions(converted);

        // Automatically select the latest real session
        if (converted.length > 0) {
          setSelectedSessionId((prev) => (!prev ? converted[0].id : prev));
        }
      } else {
        setAllSessions([]);
      }
    });
  }, []);



  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
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
    return (
      allSessions.find((s) => s.id === selectedSessionId) || allSessions[0]
    );
  }, [allSessions, selectedSessionId]);


  // Playback Toggle
  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Speed Toggle: 1.0x -> 1.25x -> 1.5x -> 2.0x -> 1.0x
  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
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
            onUpgrade={() => router.push('/upgrade')}
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
            // Mobile Top Bar
            <View style={styles.mobileFixedTopBar}>
              <View>
                <Text style={styles.brandTitleMobile}>
                  Speakwith<Text style={styles.brandAccent}>Maya</Text>
                </Text>
                <Text style={styles.brandTaglineMobile}>
                  Practice · Improve · Be Confident
                </Text>
              </View>

              <UserLevelBadge
                isPro={isPro}
                avatarSource={require('@/assets/images/maya-avatar.png')}
                onPress={() => setActivePopup('level-up')}
              />
            </View>
          ) : (
            // Desktop Top Right Level Badge Header
            <View style={styles.desktopTopHeader}>
              <View style={{ flex: 1 }} />
              <UserLevelBadge
                isPro={isPro}
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
                    {Object.keys(groupedSessions).length === 0 ? (
                      <View style={styles.emptyResultsBox}>
                        <Text style={styles.emptyResultsText}>
                          No conversations found matching your search.
                        </Text>
                      </View>
                    ) : (
                      Object.entries(groupedSessions).map(([groupTitle, sessions]) => (
                        <View key={groupTitle} style={styles.groupContainer}>
                          <Text style={styles.groupHeaderTitle}>{groupTitle}</Text>
                          {sessions.map((item) => {
                            const isSelected = item.id === activeSession?.id;
                            return (
                              <Pressable
                                key={item.id}
                                style={[
                                  styles.sessionCard,
                                  isSelected && styles.sessionCardSelected,
                                ]}
                                onPress={() => setSelectedSessionId(item.id)}
                              >
                                {/* Mode Icon in Colored Square */}
                                <View
                                  style={[
                                    styles.modeIconSquare,
                                    { backgroundColor: getModeBadgeBg(item.mode) },
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
                                  <Pressable
                                    style={styles.cardPlayButton}
                                    onPress={() => {
                                      setSelectedSessionId(item.id);
                                      togglePlay();
                                    }}
                                  >
                                    {isSelected && isPlaying ? (
                                      <HistoryPauseIcon size={34} color="#2B5BFF" />
                                    ) : (
                                      <HistoryPlayIcon size={34} color="#2B5BFF" />
                                    )}
                                  </Pressable>
                                  <Pressable
                                    style={styles.cardMoreButton}
                                    onPress={() => {}}
                                    hitSlop={8}
                                  >
                                    <MoreVerticalIcon color="#94A3B8" size={16} />
                                  </Pressable>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>

                {/* ── RIGHT COLUMN: SELECTED SESSION DETAIL ── */}
                <View style={styles.desktopDetailColumn}>
                  {activeSession ? (
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

                        <Pressable style={styles.closeDetailButton} hitSlop={10}>
                          <CloseCrossIcon size={18} color="#94A3B8" />
                        </Pressable>
                      </View>

                      {/* ── VOICE RECORDING SECTION ── */}
                      <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeaderTitle}>Voice Recording</Text>
                        <View style={styles.voiceRecordingCard}>
                          <View style={styles.voicePlayerRow}>
                            {/* Play/Pause Button */}
                            <Pressable style={styles.voicePlayButton} onPress={togglePlay}>
                              {isPlaying ? (
                                <HistoryPauseIcon size={44} color="#2B5BFF" />
                              ) : (
                                <HistoryPlayIcon size={44} color="#2B5BFF" />
                              )}
                            </Pressable>

                            {/* Waveform Visualizer */}
                            <View style={styles.waveformContainer}>
                              {WAVEFORM_HEIGHTS.map((barHeight, idx) => {
                                const fraction = idx / WAVEFORM_HEIGHTS.length;
                                const isPlayed = fraction <= playbackProgress;
                                return (
                                  <View
                                    key={idx}
                                    style={[
                                      styles.waveformBar,
                                      {
                                        height: barHeight,
                                        backgroundColor: isPlayed ? '#2B5BFF' : '#CBD5E1',
                                      },
                                    ]}
                                  />
                                );
                              })}
                            </View>

                            {/* Time & Speed Controls */}
                            <Text style={styles.voiceDurationText}>
                              {activeSession.recordingLengthString}
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

                          {/* Auto-remove notice */}
                          <View style={styles.recordingNoticeRow}>
                            <Text style={styles.noticeIconCircle}>ⓘ</Text>
                            <Text style={styles.noticeText}>
                              This recording will be automatically removed within 7 days.
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* ── SESSION TRANSCRIPT SECTION ── */}
                      <View style={styles.sectionContainer}>
                        <View style={styles.transcriptSectionHeader}>
                          <Text style={styles.sectionHeaderTitle}>Session Transcript</Text>
                          <Pressable
                            style={styles.jumpCorrectionButton}
                            onPress={handleJumpToNextCorrection}
                          >
                            <NextCorrectionIcon color="#0057FF" size={13} />
                            <Text style={styles.jumpCorrectionText}>
                              Jump to Next Correction
                            </Text>
                          </Pressable>
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
                                  {/* Speaker Name & Time */}
                                  <View style={styles.speakerHeaderRow}>
                                    <Text style={styles.speakerNameText}>
                                      {isUser ? 'You' : 'AI'}
                                    </Text>
                                    <Text style={styles.speakerTimeText}>{turn.time}</Text>
                                  </View>

                                  {/* Message Bubble */}
                                  <View
                                    style={[
                                      styles.turnBubble,
                                      isUser
                                        ? styles.userTurnBubble
                                        : styles.aiTurnBubble,
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
                                          <Pressable
                                            style={styles.audioSpeakerButton}
                                            onPress={() => {}}
                                            hitSlop={6}
                                          >
                                            <VolumeSpeakerIcon color="#94A3B8" size={16} />
                                          </Pressable>
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
            selectedSessionId ? (
              // ── MOBILE DETAIL VIEW ──
              <View style={styles.mobileDetailContainer}>
                {/* Mobile Sub-Header: Back Button, Mode Icon & Title */}
                <View style={styles.mobileDetailTopNav}>
                  <Pressable
                    style={styles.mobileBackButton}
                    onPress={() => setSelectedSessionId(null)}
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
                      <View style={styles.voicePlayerRow}>
                        <Pressable style={styles.voicePlayButton} onPress={togglePlay}>
                          {isPlaying ? (
                            <HistoryPauseIcon size={42} color="#2B5BFF" />
                          ) : (
                            <HistoryPlayIcon size={42} color="#2B5BFF" />
                          )}
                        </Pressable>

                        <View style={styles.waveformContainer}>
                          {WAVEFORM_HEIGHTS.slice(0, 32).map((barHeight, idx) => {
                            const fraction = idx / 32;
                            const isPlayed = fraction <= playbackProgress;
                            return (
                              <View
                                key={idx}
                                style={[
                                  styles.waveformBar,
                                  {
                                    height: barHeight,
                                    backgroundColor: isPlayed ? '#2B5BFF' : '#CBD5E1',
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>

                        <Text style={styles.voiceDurationText}>
                          {activeSession.recordingLengthString}
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

                      <View style={styles.recordingNoticeRow}>
                        <Text style={styles.noticeIconCircle}>ⓘ</Text>
                        <Text style={styles.noticeText}>
                          This recording will be automatically removed within 7 days.
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Session Transcript */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.transcriptSectionHeader}>
                      <Text style={styles.sectionHeaderTitle}>Session Transcript</Text>
                      <Pressable
                        style={styles.jumpCorrectionButton}
                        onPress={handleJumpToNextCorrection}
                      >
                        <NextCorrectionIcon color="#0057FF" size={13} />
                        <Text style={styles.jumpCorrectionText}>
                          Jump to Next Correction
                        </Text>
                      </Pressable>
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
                              <View style={styles.speakerHeaderRow}>
                                <Text style={styles.speakerNameText}>
                                  {isUser ? 'You' : 'AI'}
                                </Text>
                                <Text style={styles.speakerTimeText}>{turn.time}</Text>
                              </View>

                              <View
                                style={[
                                  styles.turnBubble,
                                  isUser
                                    ? styles.userTurnBubble
                                    : styles.aiTurnBubble,
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
                                      <Pressable
                                        style={styles.audioSpeakerButton}
                                        onPress={() => {}}
                                        hitSlop={6}
                                      >
                                        <VolumeSpeakerIcon color="#94A3B8" size={16} />
                                      </Pressable>
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
                {Object.keys(groupedSessions).length === 0 ? (
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
                        <Pressable
                          key={item.id}
                          style={styles.mobileSessionCard}
                          onPress={() => setSelectedSessionId(item.id)}
                        >
                          <View
                            style={[
                              styles.modeIconSquare,
                              { backgroundColor: getModeBadgeBg(item.mode) },
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
                            <Pressable
                              style={styles.cardPlayButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedSessionId(item.id);
                                togglePlay();
                              }}
                            >
                              <HistoryPlayIcon size={36} color="#2B5BFF" />
                            </Pressable>
                            <Pressable
                              style={styles.cardMoreButton}
                              onPress={(e) => e.stopPropagation()}
                              hitSlop={8}
                            >
                              <MoreVerticalIcon color="#94A3B8" size={18} />
                            </Pressable>
                          </View>
                        </Pressable>
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
          preset={activePopup || 'level-up'}
          onClose={() => setActivePopup(null)}
          minutesUsed={320}
          minutesTotal={600}
          onPrimaryPress={() => {
            if (activePopup === 'get-extra-time' || activePopup === 'unlock-premium') {
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
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Desktop Top Header ──
  desktopTopHeader: {
    height: 64,
    paddingHorizontal: 40,
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
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 24,
  },
  desktopTitleSection: {
    marginBottom: 20,
  },
  screenMainTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 32,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  desktopColumnsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 32,
  },

  // ── Desktop Left List Column ──
  desktopListColumn: {
    width: 390,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 24,
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...(Platform.OS === 'web'
      ? {
          transition: 'all 0.15s ease',
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
  sessionCardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
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
    height: 40,
    gap: 3,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2.5,
  },
  voiceDurationText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 4,
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
    gap: 8,
    marginBottom: 6,
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
  turnBubble: {
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
});
