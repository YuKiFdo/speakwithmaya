import React, { useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle, Line, SvgXml } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { fetchAllPracticeSessions } from '@/services/supabase';
import { adaptSvgColor } from '@/app/admin/roadmap';
import {
  LockIcon,
} from '@/components/icons/nav-icons';
import {
  RoadmapRobotIcon,
  RoadmapChatIcon,
  RoadmapCheckIcon,
  RoadmapFamilyIcon,
  RoadmapHomeIcon,
  RoadmapWaveIcon,
  RoadmapDirectionsIcon,
} from '@/components/icons/roadmap-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { MissionCardModal } from '@/components/roadmap/mission-card-modal';

export interface MilestoneItem {
  id: string;
  levelNumber: number;
  number: string;
  title: string;
  sessionTime: string;
  xpReward: number;
  status: 'completed' | 'in-progress' | 'locked';
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  customSvg?: string;
  align?: 'left' | 'right';
  numberColor: string;
  haloColor: string;
  haloBorderColor?: string;
  innerBg: string;
  topic?: string;
  scenarioId?: string;
  practicePoints?: string[];
  canonicalContent?: string;
  passingScorePercent?: number;
}

let cachedRoadmapMilestones: MilestoneItem[] | null = null;

function getInitialCompletedLevelIds(): Set<string> {
  const set = new Set<string>();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('maya_cached_completed_levels');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id: string) => set.add(id));
        }
      }
    } catch {}
  }
  return set;
}

function getInitialMilestones(): MilestoneItem[] {
  const baseList =
    cachedRoadmapMilestones && cachedRoadmapMilestones.length > 0
      ? cachedRoadmapMilestones
      : [];

  const completedIds = getInitialCompletedLevelIds();
  if (completedIds.size === 0) {
    return baseList;
  }

  // Pre-seed completed level numbers from cached completed IDs
  const completedLevelNumbers = new Set<number>();
  baseList.forEach((lvl, idx) => {
    const num = lvl.levelNumber ?? idx + 1;
    if (
      completedIds.has(lvl.id) ||
      completedIds.has(`lvl-${num}`) ||
      completedIds.has(`lvl-0${num}`) ||
      completedIds.has(String(num))
    ) {
      completedLevelNumbers.add(num);
      completedIds.add(lvl.id);
    }
  });

  return baseList.map((lvl, idx) => {
    const levelNum = lvl.levelNumber ?? idx + 1;
    const prevLvl = idx > 0 ? baseList[idx - 1] : null;
    const prevNum = prevLvl ? (prevLvl.levelNumber ?? idx) : null;

    const isThisLevelCompleted =
      completedIds.has(lvl.id) ||
      completedLevelNumbers.has(levelNum);

    const isPrevLevelCompleted =
      levelNum === 1 ||
      (prevNum !== null && completedLevelNumbers.has(prevNum)) ||
      (prevLvl !== null && completedIds.has(prevLvl.id)) ||
      completedLevelNumbers.has(levelNum - 1);

    const status: 'completed' | 'in-progress' | 'locked' = isThisLevelCompleted
      ? 'completed'
      : (levelNum === 1 || isPrevLevelCompleted ? 'in-progress' : 'locked');

    return { ...lvl, status };
  });
}

export default function RoadmapScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name || 'Tharindu';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<DashboardTab>('roadmap');
  const [isPro, setIsPro] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);
  const [selectedMission, setSelectedMission] = useState<MilestoneItem | null>(null);

  const [milestones, setMilestones] = useState<MilestoneItem[]>(getInitialMilestones);
  const [isLoadingLevels, setIsLoadingLevels] = useState<boolean>(!cachedRoadmapMilestones);

  // Fetch published levels from backend & sync student unlocked status
  const fetchRoadmapData = async () => {
    try {
      const baseUrl = getBackendBaseUrl();
      const [roadmapRes, sessions] = await Promise.all([
        fetch(`${baseUrl}/v1/roadmap`).catch(() => null),
        fetchAllPracticeSessions().catch(() => []),
      ]);

      let backendLevels: any[] = [];
      if (roadmapRes && roadmapRes.ok) {
        const json = await roadmapRes.json();
        if (Array.isArray(json.levels) && json.levels.length > 0) {
          backendLevels = json.levels;
        }
      }

      const sourceLevels = backendLevels;

      // Determine which levels the student has genuinely completed
      const completedLevelIds = getInitialCompletedLevelIds();
      const completedLevelNumbers = new Set<number>();

      // 1. Pre-seed completed level numbers from cached storage
      sourceLevels.forEach((lvl: any, idx: number) => {
        const lvlNum = lvl.levelNumber ?? idx + 1;
        if (
          completedLevelIds.has(lvl.id) ||
          completedLevelIds.has(`lvl-${lvlNum}`) ||
          completedLevelIds.has(`lvl-0${lvlNum}`) ||
          completedLevelIds.has(String(lvlNum))
        ) {
          completedLevelNumbers.add(lvlNum);
          completedLevelIds.add(lvl.id);
        }
      });

      // 2. Cross-reference with completed sessions recorded in backend
      if (Array.isArray(sessions)) {
        sessions.forEach((s: any) => {
          if (s.status === 'completed') {
            if (s.roadmap_level_id) {
              completedLevelIds.add(s.roadmap_level_id);
            }
            // Match against level topic/title or roadmap_level_id
            sourceLevels.forEach((lvl: any, idx: number) => {
              const lvlNum = lvl.levelNumber ?? idx + 1;
              const lvlTopic = (lvl.topic || '').trim().toLowerCase();
              const lvlTitle = (lvl.title || '').trim().toLowerCase();
              const sTopic = (s.topic || '').trim().toLowerCase();
              if (
                s.roadmap_level_id === lvl.id ||
                s.roadmap_level_id === `lvl-${lvlNum}` ||
                s.roadmap_level_id === `lvl-0${lvlNum}` ||
                (sTopic && (sTopic === lvlTopic || sTopic === lvlTitle))
              ) {
                completedLevelIds.add(lvl.id);
                completedLevelNumbers.add(lvlNum);
              }
            });
          }
        });
      }

      const mappedMilestones: MilestoneItem[] = sourceLevels.map((lvl: any, idx: number) => {
        const levelNum = lvl.levelNumber ?? idx + 1;
        const prevLevel = idx > 0 ? sourceLevels[idx - 1] : null;
        const prevLevelNum = prevLevel ? (prevLevel.levelNumber ?? idx) : null;

        const isThisLevelCompleted =
          completedLevelIds.has(lvl.id) ||
          completedLevelNumbers.has(levelNum);

        const isPrevLevelCompleted =
          levelNum === 1 ||
          (prevLevelNum !== null && completedLevelNumbers.has(prevLevelNum)) ||
          (prevLevel !== null && completedLevelIds.has(prevLevel.id)) ||
          completedLevelNumbers.has(levelNum - 1);

        let status: 'completed' | 'in-progress' | 'locked' = 'locked';

        if (isThisLevelCompleted) {
          status = 'completed';
        } else if (levelNum === 1 || isPrevLevelCompleted) {
          status = 'in-progress';
        } else {
          status = 'locked';
        }

        const rawPoints = lvl.practice_points || lvl.practicePoints || (Array.isArray(lvl.learningObjectives) ? lvl.learningObjectives.map((o: any) => o.title || o) : []);
        const practicePoints: string[] = Array.isArray(rawPoints)
          ? rawPoints.map((p: any) => (typeof p === 'string' ? p : p.title || String(p)))
          : [];

        return {
          id: lvl.id || `lvl-${levelNum}`,
          levelNumber: levelNum,
          number: String(levelNum).padStart(2, '0'),
          title: lvl.title,
          sessionTime: practicePoints.length > 0 ? `${practicePoints.length} Tasks` : '',
          xpReward: lvl.xpReward || 50 + idx * 25,
          status,
          iconType: lvl.iconType || 'chat',
          customSvg: lvl.customSvg,
          numberColor: lvl.numberColor || '#0057FF',
          haloColor: lvl.haloColor || '#EFF6FF',
          haloBorderColor: lvl.haloBorderColor || '#BFDBFE',
          innerBg: '#FFFFFF',
          topic: lvl.topic,
          scenarioId: lvl.scenarioId,
          practicePoints,
          canonicalContent: lvl.canonicalContent || lvl.canonical_content || '',
          passingScorePercent: lvl.passingScorePercent || lvl.passing_score_percent || 75,
        };
      });

      cachedRoadmapMilestones = mappedMilestones;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(
            'maya_cached_completed_levels',
            JSON.stringify(Array.from(completedLevelIds)),
          );
        } catch {}
      }

      setMilestones(mappedMilestones);
    } catch (e) {
      console.warn('[Roadmap] Error fetching dynamic roadmap data:', e);
    } finally {
      setIsLoadingLevels(false);
    }
  };

  useEffect(() => {
    fetchRoadmapData();
  }, []);

  // Responsive full-width calculations for desktop track & milestone columns:
  const [layoutTrackWidth, setLayoutTrackWidth] = useState<number | null>(null);
  const trackWidth = layoutTrackWidth ?? (isDesktop ? Math.max(900, windowWidth - 340) : windowWidth - 40);

  const xLeft = 40;
  const xRight = Math.max(860, trackWidth - 40);
  const R = 90;
  const desktopYStart = 200;
  const desktopRowStep = 180;
  const lastIdx = milestones.length - 1;
  const finalR = Math.max(0, Math.floor(lastIdx / 2));
  const finalCol = lastIdx >= 0 ? lastIdx % 2 : 0;
  const desktopRowCount = finalR + 1;
  const desktopTrackHeight = desktopYStart + finalR * desktopRowStep + 90;

  // Symmetrically distribute column 1 and column 2 across the full container width:
  const col1X = Math.round(xLeft + (xRight - xLeft) * 0.16);
  const col2X = Math.round(xLeft + (xRight - xLeft) * 0.54);

  // Dynamically generate Desktop Serpentine Track:
  let desktopSvgPath = '';
  if (milestones.length === 1) {
    desktopSvgPath = `M ${col1X} ${desktopYStart} L ${col1X} ${desktopYStart}`;
  } else if (milestones.length > 1) {
    desktopSvgPath = `M ${col1X} ${desktopYStart}`;

    for (let r = 0; r <= finalR; r++) {
      const yRow = desktopYStart + r * desktopRowStep;
      const isFinalRow = r === finalR;

      if (r === 0) {
        if (isFinalRow) {
          const targetX = finalCol === 0 ? col1X : col2X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
        }
      } else if (r % 2 === 1) {
        if (isFinalRow) {
          const targetX = finalCol === 0 ? col2X : col1X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext}`;
        }
      } else {
        if (isFinalRow) {
          const targetX = finalCol === 0 ? col1X : col2X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
        }
      }
    }
  }

  // Responsive calculations for mobile track & milestone positions:
  const [layoutMobileWidth, setLayoutMobileWidth] = useState<number | null>(null);
  const mobileWidth = layoutMobileWidth ?? (!isDesktop ? Math.min(windowWidth - 40, 420) : 350);

  // Mobile serpentine geometry
  const mobileR = 64;
  const mobileTierHeight = mobileR * 2; // 128
  const mobileIconSize = 62;
  const mobileYDropLen = 26;
  const mobileYTrack1 = 88;

  const mobileIconLeftX = 10 + mobileR; // 74
  const mobileIconRightX = mobileWidth - (10 + mobileR); // mobileWidth - 74

  const mobileTotalHeight =
    milestones.length > 0
      ? mobileYTrack1 + (milestones.length - 1) * mobileTierHeight + 92
      : 820;

  // Dynamically generate Mobile Serpentine Track:
  let mobileSvgPath = '';
  if (milestones.length === 1) {
    mobileSvgPath = `M ${mobileIconLeftX} ${mobileYTrack1} L ${mobileIconLeftX} ${mobileYTrack1}`;
  } else if (milestones.length > 1) {
    mobileSvgPath = `M ${mobileIconLeftX} ${mobileYTrack1} L ${mobileIconRightX} ${mobileYTrack1}`;
    for (let i = 0; i < milestones.length - 1; i++) {
      const yNext = mobileYTrack1 + (i + 1) * mobileTierHeight;
      const isLastStep = i === milestones.length - 2;

      if (i % 2 === 0) {
        mobileSvgPath += ` A ${mobileR} ${mobileR} 0 0 1 ${mobileIconRightX} ${yNext}`;
        if (!isLastStep) {
          mobileSvgPath += ` L ${mobileIconLeftX} ${yNext}`;
        }
      } else {
        mobileSvgPath += ` A ${mobileR} ${mobileR} 0 0 0 ${mobileIconLeftX} ${yNext}`;
        if (!isLastStep) {
          mobileSvgPath += ` L ${mobileIconRightX} ${yNext}`;
        }
      }
    }
  }

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.push({ pathname: '/dashboard', params });
    } else if (tab === 'history') {
      router.push({ pathname: '/history', params });
    } else if (tab === 'account') {
      router.push({ pathname: '/account', params });
    } else {
      setActiveTab(tab);
    }
  };

  const handleMilestonePress = (item: MilestoneItem) => {
    if (item.status === 'locked' && !isPro) {
      setActivePopup('unlock-premium');
    } else {
      setSelectedMission(item);
    }
  };

  const handleStartMission = (item: MilestoneItem) => {
    setSelectedMission(null);
    router.push({
      pathname: '/onboarding/call',
      params: {
        ...params,
        roadmapLevelId: item.id,
        levelNumber: String(item.levelNumber),
        topic: item.topic || item.title,
        scenarioTitle: item.title,
        scenarioId: item.scenarioId || 'general-practice',
        practicePoints: JSON.stringify(item.practicePoints || []),
        canonicalContent: item.canonicalContent || '',
        passingScorePercent: String(item.passingScorePercent || 75),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* ==================================================================== */}
        {/* DESKTOP SIDEBAR NAVIGATION */}
        {/* ==================================================================== */}
        {isDesktop && (
          <DesktopSidebar
            activeTab="roadmap"
            onSelectTab={handleSelectTab}
            isPro={isPro}
            onUpgrade={() => router.push('/upgrade')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* ==================================================================== */}
        {/* MAIN CONTAINER WITH FIXED MOBILE TOP BAR */}
        {/* ==================================================================== */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR (PINNED) */}
          {!isDesktop && (
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
          )}

          {/* MAIN SCROLLABLE CONTENT */}
          <ScrollView
            style={[styles.mainScroll, isDesktop && styles.mainScrollDesktop]}
            contentContainerStyle={[
              styles.mainScrollContent,
              isDesktop && styles.mainScrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* DESKTOP TOP HEADER */}
            {isDesktop && (
              <View style={styles.desktopTopHeader}>
                <View>
                  <Text style={styles.headingTitle}>Your Learning Roadmap</Text>
                  <Text style={styles.headingSubtitle}>
                    Your journey to fluency starts here!
                  </Text>
                </View>

                {/* User Level Badge */}
                <UserLevelBadge
                  isPro={isPro}
                  avatarSource={require('@/assets/images/maya-avatar.png')}
                  onPress={() => setActivePopup('level-up')}
                />
              </View>
            )}

          {/* MOBILE HEADING */}
          {!isDesktop && (
            <View style={styles.mobileHeadingSection}>
              <Text style={styles.headingTitleMobile}>Your Learning Roadmap</Text>
              <Text style={styles.headingSubtitleMobile}>
                Your journey to fluency starts here!
              </Text>
            </View>
          )}

          {/* ==================================================================== */}
          {/* ROADMAP TRACK & MILESTONES */}
          {/* ==================================================================== */}
          {isLoadingLevels ? (
            <View style={styles.roadmapStatusCard}>
              <ActivityIndicator size="large" color="#0057FF" />
              <Text style={styles.roadmapStatusText}>Loading your learning path...</Text>
            </View>
          ) : milestones.length === 0 ? (
            <View style={styles.roadmapStatusCard}>
              <View style={styles.roadmapEmptyIconWrapper}>
                <Feather name="map" size={36} color="#0057FF" />
              </View>
              <Text style={styles.roadmapEmptyTitle}>No Roadmap Levels Yet</Text>
              <Text style={styles.roadmapEmptyText}>
                No published levels available at the moment. Levels will appear here once created.
              </Text>
            </View>
          ) : isDesktop ? (
            /* ================================================================ */
            /* DESKTOP ROADMAP (100% FULL WIDTH WITH ACCURATE CONNECTIONS)      */
            /* ================================================================ */
            <View
              style={[styles.roadmapTrackContainerDesktop, { height: desktopTrackHeight }]}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - trackWidth) > 5) {
                  setLayoutTrackWidth(w);
                }
              }}
            >
              <Svg
                style={StyleSheet.absoluteFill}
                width={trackWidth}
                height={desktopTrackHeight}
                viewBox={`0 0 ${trackWidth} ${desktopTrackHeight}`}
              >
                {/* 1. Outer Emboss / Bevel Shadow */}
                <Path
                  d={desktopSvgPath}
                  stroke="#c8c8c8ff"
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.65}
                />

                {/* 2. Main Track Bed */}
                <Path
                  d={desktopSvgPath}
                  stroke="#f2f2f2ff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 3. Inner Inset Shadow (Recessed Groove Depth) */}
                <Path
                  d={desktopSvgPath}
                  stroke="rgba(201, 201, 201, 0.09)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 4. Center Core Inset Highlight */}
                <Path
                  d={desktopSvgPath}
                  stroke="rgba(235, 235, 235, 0.75)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Vertical Dotted Drops from Card Icons down to Anchors */}
                {milestones.map((item, idx) => {
                  const r = Math.floor(idx / 2);
                  const isReversedRow = r % 2 === 1;
                  const x = isReversedRow
                    ? (idx % 2 === 0 ? col2X : col1X)
                    : (idx % 2 === 0 ? col1X : col2X);
                  const trackY = desktopYStart + r * desktopRowStep;
                  const dropYStart = 128 + r * desktopRowStep;
                  const isLocked = item.status === 'locked';
                  return (
                    <Line
                      key={`desktop-drop-${idx}`}
                      x1={x}
                      y1={dropYStart}
                      x2={x}
                      y2={trackY}
                      stroke={isLocked ? '#CBD5E1' : '#93C5FD'}
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {/* Blue / Grey / Glowing Anchor Dots on the Track */}
                {milestones.map((item, idx) => {
                  const r = Math.floor(idx / 2);
                  const isReversedRow = r % 2 === 1;
                  const x = isReversedRow
                    ? (idx % 2 === 0 ? col2X : col1X)
                    : (idx % 2 === 0 ? col1X : col2X);
                  const trackY = desktopYStart + r * desktopRowStep;
                  const isLocked = item.status === 'locked';
                  const isAvailable = item.status === 'in-progress';
                  return (
                    <React.Fragment key={`desktop-dot-${idx}`}>
                      {isAvailable ? (
                        <>
                          <Circle
                            cx={x}
                            cy={trackY}
                            r={16}
                            fill="rgba(0, 87, 255, 0.22)"
                          />
                          <Circle
                            cx={x}
                            cy={trackY}
                            r={9}
                            fill="#0057FF"
                          />
                          <Circle
                            cx={x}
                            cy={trackY}
                            r={4}
                            fill="#FFFFFF"
                          />
                        </>
                      ) : (
                        <>
                          <Circle
                            cx={x}
                            cy={trackY}
                            r={10}
                            fill={isLocked ? 'rgba(148, 163, 184, 0.16)' : 'rgba(0, 87, 255, 0.18)'}
                          />
                          <Circle
                            cx={x}
                            cy={trackY}
                            r={5}
                            fill={isLocked ? '#94A3B8' : '#0057FF'}
                            stroke="#FFFFFF"
                            strokeWidth={1.8}
                          />
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </Svg>

              {/* Milestone Cards Overlay - Symmetrically Distributed Across Full Width */}
              {milestones.map((item, idx) => {
                const r = Math.floor(idx / 2);
                const isReversedRow = r % 2 === 1;
                const x = isReversedRow
                  ? (idx % 2 === 0 ? col2X : col1X)
                  : (idx % 2 === 0 ? col1X : col2X);
                const cardTop = 40 + r * desktopRowStep;

                return (
                  <View
                    key={item.id}
                    style={[styles.desktopCardSlot, { top: cardTop, left: x - 44 }]}
                  >
                    <MilestoneCardDesktop
                      item={item}
                      onPress={() => handleMilestonePress(item)}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            /* ================================================================ */
            /* MOBILE SERPENTINE ROADMAP (MATCHES DESKTOP INNER SHADOW & NODES) */
            /* ================================================================ */
            <View
              style={[styles.mobileRoadmapContainer, { height: mobileTotalHeight }]}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - mobileWidth) > 3) {
                  setLayoutMobileWidth(w);
                }
              }}
            >
              {/* Background SVG Serpentine Track with 3D Inner Shadow (Matches Desktop) */}
              <Svg
                style={StyleSheet.absoluteFill}
                width={mobileWidth}
                height={mobileTotalHeight}
                viewBox={`0 0 ${mobileWidth} ${mobileTotalHeight}`}
              >
                {/* 1. Outer Emboss / Bevel Shadow */}
                <Path
                  d={mobileSvgPath}
                  stroke="#c8c8c8ff"
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.65}
                />

                {/* 2. Main Track Bed */}
                <Path
                  d={mobileSvgPath}
                  stroke="#f2f2f2ff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 3. Inner Inset Shadow (Recessed Groove Depth) */}
                <Path
                  d={mobileSvgPath}
                  stroke="rgba(201, 201, 201, 0.09)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 4. Center Core Inset Highlight */}
                <Path
                  d={mobileSvgPath}
                  stroke="rgba(235, 235, 235, 0.75)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Vertical Dotted Drops from Card Avatar bottom down to Track Dots */}
                {milestones.map((item, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  const yStart = yTrack - mobileYDropLen;
                  const isLocked = item.status === 'locked';
                  return (
                    <Line
                      key={`mobile-drop-${idx}`}
                      x1={x}
                      y1={yStart}
                      x2={x}
                      y2={yTrack}
                      stroke={isLocked ? '#CBD5E1' : '#93C5FD'}
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {/* Blue / Grey / Glowing Anchor Dots on the Track */}
                {milestones.map((item, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  const isLocked = item.status === 'locked';
                  const isAvailable = item.status === 'in-progress';
                  return (
                    <React.Fragment key={`mobile-dot-${idx}`}>
                      {isAvailable ? (
                        <>
                          <Circle
                            cx={x}
                            cy={yTrack}
                            r={16}
                            fill="rgba(0, 87, 255, 0.22)"
                          />
                          <Circle
                            cx={x}
                            cy={yTrack}
                            r={9}
                            fill="#0057FF"
                          />
                          <Circle
                            cx={x}
                            cy={yTrack}
                            r={4}
                            fill="#FFFFFF"
                          />
                        </>
                      ) : (
                        <>
                          <Circle
                            cx={x}
                            cy={yTrack}
                            r={10}
                            fill={isLocked ? 'rgba(148, 163, 184, 0.16)' : 'rgba(0, 87, 255, 0.18)'}
                          />
                          <Circle
                            cx={x}
                            cy={yTrack}
                            r={5}
                            fill={isLocked ? '#94A3B8' : '#0057FF'}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </Svg>

              {/* Absolute Floating Milestone Nodes */}
              {milestones.map((item, idx) => {
                const isLeft = idx % 2 === 0;
                const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                const slotTop = yTrack - mobileYDropLen - mobileIconSize;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.mobileNodeSlot,
                      {
                        top: slotTop,
                        ...(isLeft
                          ? { left: mobileIconLeftX - mobileIconSize / 2 }
                          : { right: mobileWidth - mobileIconRightX - mobileIconSize / 2 }),
                        maxWidth: mobileWidth - 36,
                      },
                    ]}
                  >
                    <MilestoneCardMobile
                      item={item}
                      isLeft={isLeft}
                      onPress={() => handleMilestonePress(item)}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Bottom extra scroll clearance */}
          <View style={{ height: 80 }} />
        </ScrollView>
      </View>



        {/* ==================================================================== */}
        {/* POPUP MODAL */}
        {/* ==================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'unlock-premium'}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={() => {
            if (activePopup === 'unlock-premium') {
              router.push('/upgrade');
            }
            setActivePopup(null);
          }}
          onFooterButtonPress={() => {
            router.push('/upgrade');
            setActivePopup(null);
          }}
        />

        {/* ==================================================================== */}
        {/* MISSION CARD PREVIEW MODAL */}
        {/* ==================================================================== */}
        <MissionCardModal
          visible={selectedMission !== null}
          item={selectedMission}
          userName={displayName}
          nextItem={
            selectedMission
              ? milestones.find(
                  (m) =>
                    (m.levelNumber ?? 0) === (selectedMission.levelNumber ?? 0) + 1 &&
                    m.status !== 'locked',
                ) || null
              : null
          }
          onClose={() => setSelectedMission(null)}
          onStartPractice={handleStartMission}
          onNextLevel={(next) => {
            setSelectedMission(null);
            setTimeout(() => {
              setSelectedMission(next);
            }, 100);
          }}
          onViewHistory={() => {
            setSelectedMission(null);
            router.push({ pathname: '/history', params });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * Milestone Icon Renderer
 */
function MilestoneIcon({
  type,
  size = 30,
  customSvg,
  color = '#0057FF',
}: {
  type: MilestoneItem['iconType'];
  size?: number;
  customSvg?: string;
  color?: string;
}) {
  if (customSvg && customSvg.trim()) {
    try {
      const adapted = adaptSvgColor(customSvg, color);
      if (adapted) {
        return <SvgXml xml={adapted} width={size} height={size} />;
      }
    } catch (e) {
      // fallback
    }
  }

  switch (type) {
    case 'robot':
      return <RoadmapRobotIcon size={size} color={color} />;
    case 'chat':
      return <RoadmapChatIcon size={size} color={color} />;
    case 'family':
      return <RoadmapFamilyIcon size={size} color={color} />;
    case 'home':
      return <RoadmapHomeIcon size={size} color={color} />;
    case 'wave':
      return <RoadmapWaveIcon size={size} color={color} />;
    case 'directions':
      return <RoadmapDirectionsIcon size={size} color={color} />;
    default:
      return <LockIcon color={color || '#94A3B8'} size={Math.round(size * 0.7)} />;
  }
}

function getBorderColor(id: string) {
  switch (id) {
    case '01':
      return '#BFDBFE';
    case '02':
      return '#E9D5FF';
    case '03':
      return '#FECDD3';
    case '04':
      return '#A7F3D0';
    case '05':
      return '#FDE68A';
    case '06':
      return '#BFDBFE';
    default:
      return '#E2E8F0';
  }
}

/**
 * Gamified pulsing radar ring & floating 'START' beacon for active available milestones
 */
interface ActiveBeaconHaloProps {
  size?: number;
  color?: string;
  showStartBadge?: boolean;
  children: React.ReactNode;
}

function ActiveBeaconHalo({
  size = 88,
  color = '#0057FF',
  showStartBadge = true,
  children,
}: ActiveBeaconHaloProps) {
  const rippleAnim = React.useRef(new Animated.Value(0)).current;
  const rippleAnim2 = React.useRef(new Animated.Value(0)).current;
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  const nodeBreathAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Primary radar ring
    const rippleLoop = Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    // Secondary ripple for mobile rich depth
    const ripple2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(rippleAnim2, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(rippleAnim2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Desktop bouncing 'START' pill
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -6,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Mobile subtle node breathing
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(nodeBreathAnim, {
          toValue: 1.045,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(nodeBreathAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    rippleLoop.start();
    if (!showStartBadge) {
      ripple2Loop.start();
      breathLoop.start();
    }
    if (showStartBadge) {
      bounceLoop.start();
    }

    return () => {
      rippleLoop.stop();
      ripple2Loop.stop();
      bounceLoop.stop();
      breathLoop.stop();
    };
  }, [showStartBadge]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, showStartBadge ? 1.34 : 1.42],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.55, 0.28, 0],
  });

  const ripple2Scale = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });

  const ripple2Opacity = rippleAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.4, 0.18, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Concentric Pulsing Radar Ring 1 */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: rippleScale }],
          opacity: rippleOpacity,
          zIndex: 0,
        }}
        pointerEvents="none"
      />

      {/* Secondary Staggered Wave (Mobile Screen Specific) */}
      {!showStartBadge && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: color,
            transform: [{ scale: ripple2Scale }],
            opacity: ripple2Opacity,
            zIndex: 0,
          }}
          pointerEvents="none"
        />
      )}

      {/* Floating Gamified 'START' Pill with Downward Arrow (Desktop Only) */}
      {showStartBadge && (
        <Animated.View
          style={{
            position: 'absolute',
            top: size > 70 ? -24 : -20,
            alignSelf: 'center',
            alignItems: 'center',
            zIndex: 10,
            transform: [{ translateY: bounceAnim }],
          }}
          pointerEvents="none"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: color,
              paddingHorizontal: 8,
              paddingVertical: 2.5,
              borderRadius: 12,
              gap: 3.5,
              ...(Platform.OS === 'web'
                ? ({ boxShadow: `0px 3px 8px ${color}66` } as any)
                : {
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.35,
                    shadowRadius: 4,
                    elevation: 4,
                  }),
            }}
          >
            <Feather name="play" size={8.5} color="#FFFFFF" />
            <Text
              style={{
                ...fontStyle('outfit', 'bold'),
                fontSize: 9.5,
                color: '#FFFFFF',
                letterSpacing: 0.8,
              }}
            >
              START
            </Text>
          </View>
          {/* Pointer downward tip */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 4,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
              marginTop: -0.5,
            }}
          />
        </Animated.View>
      )}

      {/* Inner Node Content (with subtle breathing on mobile) */}
      <Animated.View
        style={{
          zIndex: 2,
          transform: !showStartBadge ? [{ scale: nodeBreathAnim }] : undefined,
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Desktop Milestone Node Component
 */
function MilestoneCardDesktop({
  item,
  onPress,
}: {
  item: MilestoneItem;
  onPress: () => void;
}) {
  const isLocked = item.status === 'locked';
  const isAvailable = item.status === 'in-progress';
  const isCompleted = item.status === 'completed';
  const haloBg = isLocked ? '#f1f5f9' : item.haloColor;
  const haloBorder = isLocked ? '#cbd5e1' : item.haloBorderColor || getBorderColor(item.id);
  const numberColor = isLocked ? '#94a3b8' : item.numberColor;
  const iconColor = isLocked ? '#94a3b8' : item.numberColor;

  const [isHovered, setIsHovered] = useState(false);
  const lockShakeAnim = React.useRef(new Animated.Value(0)).current;
  const iconTiltAnim = React.useRef(new Animated.Value(0)).current;
  const checkBounceAnim = React.useRef(new Animated.Value(1)).current;

  const triggerLockShake = () => {
    Animated.sequence([
      Animated.timing(lockShakeAnim, { toValue: -4, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 4, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: -3, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 3, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  React.useEffect(() => {
    if (isHovered) {
      if (isLocked) {
        triggerLockShake();
      } else {
        // Playful icon micro-tilt
        Animated.sequence([
          Animated.timing(iconTiltAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(iconTiltAnim, { toValue: -1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(iconTiltAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();

        if (isCompleted) {
          Animated.sequence([
            Animated.timing(checkBounceAnim, { toValue: 1.25, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(checkBounceAnim, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
          ]).start();
        }
      }
    }
  }, [isHovered]);

  const iconRotate = iconTiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-7deg', '0deg', '7deg'],
  });

  const renderNodeContent = (isPressed: boolean) => (
    <View
      style={[
        styles.haloCircleDesktop,
        { backgroundColor: haloBg, borderColor: haloBorder },
        isAvailable && styles.haloCircleAvailable,
        isHovered && !isLocked && styles.haloCircleHovered,
        isAvailable && (Platform.OS === 'web'
          ? ({ boxShadow: isHovered
                ? `0 0 0 4px #FFFFFF, 0 0 0 7px ${numberColor}, 0 12px 28px ${numberColor}55`
                : `0 0 0 3px #FFFFFF, 0 0 0 5px ${numberColor}, 0 6px 20px ${numberColor}45` } as any)
          : {
              shadowColor: numberColor,
              shadowOffset: { width: 0, height: isHovered ? 8 : 4 },
              shadowOpacity: isHovered ? 0.55 : 0.45,
              shadowRadius: isHovered ? 14 : 10,
              elevation: isHovered ? 8 : 6,
            }),
        !isLocked && (isPressed
          ? { transform: [{ translateY: 2 }, { scale: 0.94 }] }
          : isHovered
          ? { transform: [{ translateY: -4 }, { scale: 1.05 }] }
          : { transform: [{ translateY: 0 }, { scale: 1 }] }),
      ]}
    >
      <Animated.View
        style={[
          styles.innerIconCircleDesktop,
          isLocked && styles.innerIconCircleLocked,
          { transform: [{ rotate: iconRotate }] },
        ]}
      >
        <MilestoneIcon type={item.iconType} customSvg={item.customSvg} color={iconColor} />
      </Animated.View>

      {item.status === 'completed' && (
        <Animated.View
          style={[styles.checkBadgeWrapper, { transform: [{ scale: checkBounceAnim }] }]}
        >
          <RoadmapCheckIcon size={22} />
        </Animated.View>
      )}

      {isLocked && (
        <Animated.View
          style={[
            styles.lockBadgeWrapperDesktop,
            { transform: [{ translateX: lockShakeAnim }] },
          ]}
        >
          <Feather name="lock" size={13} color="#64748b" />
        </Animated.View>
      )}
    </View>
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.milestoneCardDesktop,
        isLocked && styles.milestoneCardLocked,
        isHovered && !isLocked && styles.milestoneCardHovered,
      ]}
      onPress={() => {
        if (isLocked) {
          triggerLockShake();
        }
        onPress();
      }}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`Milestone ${item.number}: ${item.title}`}
    >
      {({ pressed }) => (
        <>
          {isAvailable ? (
            <ActiveBeaconHalo size={88} color={numberColor}>
              {renderNodeContent(pressed)}
            </ActiveBeaconHalo>
          ) : (
            renderNodeContent(pressed)
          )}

          <View style={styles.milestoneTextCol}>
            <View style={styles.numberBadgeRow}>
              <Text style={[styles.milestoneNumber, { color: numberColor }]}>
                {item.number}
              </Text>
              {item.status === 'completed' ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>COMPLETED</Text>
                </View>
              ) : isLocked ? (
                <View style={styles.lockedBadge}>
                  <Feather name="lock" size={10} color="#64748b" style={{ marginRight: 3 }} />
                  <Text style={styles.lockedBadgeText}>LOCKED</Text>
                </View>
              ) : (
                <>
                  <View style={styles.currentBadge}>
                    <View style={styles.currentBadgeDot} />
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                  <View
                    style={[
                      styles.xpBadge,
                      isHovered && { transform: [{ scale: 1.08 }] },
                    ]}
                  >
                    <Feather name="award" size={11} color="#d97706" style={{ marginRight: 3 }} />
                    <Text style={styles.xpBadgeText}>+{item.xpReward} XP</Text>
                  </View>
                </>
              )}
            </View>

            <Text
              style={[
                styles.milestoneTitle,
                isLocked && styles.milestoneTitleLocked,
                isHovered && !isLocked && styles.milestoneTitleHovered,
                pressed && !isLocked && { color: '#0040C1' },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text style={[styles.milestoneSessionTime, isLocked && styles.milestoneSessionTimeLocked]}>
              {item.sessionTime}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/**
 * Mobile Milestone Node Component (Matches Desktop Floating Style without Card Box)
 */
function MilestoneCardMobile({
  item,
  isLeft = true,
  onPress,
}: {
  item: MilestoneItem;
  isLeft?: boolean;
  onPress: () => void;
}) {
  const isLocked = item.status === 'locked';
  const isAvailable = item.status === 'in-progress';
  const isCompleted = item.status === 'completed';
  const haloBg = isLocked ? '#f1f5f9' : item.haloColor;
  const borderColor = isLocked ? '#cbd5e1' : item.haloBorderColor || getBorderColor(item.id);
  const numberColor = isLocked ? '#94a3b8' : item.numberColor;
  const iconColor = isLocked ? '#94a3b8' : item.numberColor;

  const [isHovered, setIsHovered] = useState(false);
  const lockShakeAnim = React.useRef(new Animated.Value(0)).current;
  const iconTiltAnim = React.useRef(new Animated.Value(0)).current;
  const checkBounceAnim = React.useRef(new Animated.Value(1)).current;
  const liveDotAnim = React.useRef(new Animated.Value(1)).current;

  const triggerLockShake = () => {
    Animated.sequence([
      Animated.timing(lockShakeAnim, { toValue: -4, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 4, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: -3, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 3, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(lockShakeAnim, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  React.useEffect(() => {
    if (isAvailable) {
      const liveLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(liveDotAnim, {
            toValue: 1.5,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(liveDotAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      liveLoop.start();
      return () => liveLoop.stop();
    }
  }, [isAvailable]);

  React.useEffect(() => {
    if (isHovered) {
      if (isLocked) {
        triggerLockShake();
      } else {
        Animated.sequence([
          Animated.timing(iconTiltAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(iconTiltAnim, { toValue: -1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(iconTiltAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();

        if (isCompleted) {
          Animated.sequence([
            Animated.timing(checkBounceAnim, { toValue: 1.25, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(checkBounceAnim, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
          ]).start();
        }
      }
    }
  }, [isHovered]);

  const iconRotate = iconTiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-7deg', '0deg', '7deg'],
  });

  const renderNodeContent = (isPressed: boolean) => (
    <View
      style={[
        styles.haloCircleMobile,
        { backgroundColor: haloBg, borderColor },
        isAvailable && styles.haloCircleAvailableMobile,
        isHovered && !isLocked && styles.haloCircleHovered,
        isAvailable && (Platform.OS === 'web'
          ? ({ boxShadow: isHovered
                ? `0 0 0 3.5px #FFFFFF, 0 0 0 6px ${numberColor}, 0 8px 22px ${numberColor}55`
                : `0 0 0 2.5px #FFFFFF, 0 0 0 4.5px ${numberColor}, 0 4px 16px ${numberColor}45` } as any)
          : {
              shadowColor: numberColor,
              shadowOffset: { width: 0, height: isHovered ? 5 : 3 },
              shadowOpacity: isHovered ? 0.55 : 0.45,
              shadowRadius: isHovered ? 12 : 8,
              elevation: isHovered ? 7 : 5,
            }),
        !isLocked && (isPressed
          ? { transform: [{ translateY: 2 }, { scale: 0.94 }] }
          : isHovered
          ? { transform: [{ translateY: -3 }, { scale: 1.05 }] }
          : { transform: [{ translateY: 0 }, { scale: 1 }] }),
      ]}
    >
      <Animated.View
        style={[
          styles.innerIconCircleMobile,
          isLocked && styles.innerIconCircleLocked,
          { transform: [{ rotate: iconRotate }] },
        ]}
      >
        <MilestoneIcon type={item.iconType} size={24} customSvg={item.customSvg} color={iconColor} />
      </Animated.View>

      {item.status === 'completed' && (
        <Animated.View
          style={[styles.checkBadgeWrapperMobile, { transform: [{ scale: checkBounceAnim }] }]}
        >
          <RoadmapCheckIcon size={18} />
        </Animated.View>
      )}

      {isLocked && (
        <Animated.View
          style={[
            styles.lockBadgeWrapperMobile,
            { transform: [{ translateX: lockShakeAnim }] },
          ]}
        >
          <Feather name="lock" size={11} color="#64748b" />
        </Animated.View>
      )}
    </View>
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.mobileMilestoneNode,
        isLeft ? styles.mobileMilestoneNodeLeft : styles.mobileMilestoneNodeRight,
        isLocked && styles.mobileMilestoneNodeLocked,
        isHovered && !isLocked && styles.milestoneCardHovered,
      ]}
      onPress={() => {
        if (isLocked) {
          triggerLockShake();
        }
        onPress();
      }}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`Milestone ${item.number}: ${item.title}`}
    >
      {({ pressed }) => (
        <>
          {/* LEFT ALIGNED: Avatar on Left, Text on Right */}
          {isLeft ? (
            <>
              {isAvailable ? (
                <ActiveBeaconHalo size={62} color={numberColor} showStartBadge={false}>
                  {renderNodeContent(pressed)}
                </ActiveBeaconHalo>
              ) : (
                renderNodeContent(pressed)
              )}

              <View style={[styles.mobileNodeTextCol, { marginLeft: 12 }]}>
                <View style={styles.numberBadgeRowMobile}>
                  <Text style={[styles.milestoneNumberMobile, { color: numberColor }]}>
                    {item.number}
                  </Text>
                  {item.status === 'completed' ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>COMPLETED</Text>
                    </View>
                  ) : isLocked ? (
                    <View style={styles.lockedBadge}>
                      <Feather name="lock" size={9} color="#64748b" style={{ marginRight: 2 }} />
                      <Text style={styles.lockedBadgeText}>LOCKED</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.currentBadge}>
                        <Animated.View
                          style={[
                            styles.currentBadgeDot,
                            { transform: [{ scale: liveDotAnim }] },
                          ]}
                        />
                        <Text style={styles.currentBadgeText}>CURRENT</Text>
                      </View>
                      <View
                        style={[
                          styles.xpBadge,
                          isHovered && { transform: [{ scale: 1.08 }] },
                        ]}
                      >
                        <Feather name="award" size={10} color="#d97706" style={{ marginRight: 2 }} />
                        <Text style={styles.xpBadgeText}>+{item.xpReward} XP</Text>
                      </View>
                    </>
                  )}
                </View>
                <Text
                  style={[
                    styles.milestoneTitleMobile,
                    isLocked && styles.milestoneTitleLocked,
                    isHovered && !isLocked && styles.milestoneTitleHovered,
                    pressed && !isLocked && { color: '#0040C1' },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.milestoneSessionTimeMobile,
                    isLocked && styles.milestoneSessionTimeLocked,
                  ]}
                >
                  {item.sessionTime}
                </Text>
              </View>
            </>
          ) : (
            /* RIGHT ALIGNED: Text on Left, Avatar on Right */
            <>
              <View style={[styles.mobileNodeTextCol, { marginRight: 12, alignItems: 'flex-end' }]}>
                <View style={[styles.numberBadgeRowMobile, { justifyContent: 'flex-end' }]}>
                  {item.status === 'completed' ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>COMPLETED</Text>
                    </View>
                  ) : isLocked ? (
                    <View style={styles.lockedBadge}>
                      <Feather name="lock" size={9} color="#64748b" style={{ marginRight: 2 }} />
                      <Text style={styles.lockedBadgeText}>LOCKED</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.currentBadge}>
                        <Animated.View
                          style={[
                            styles.currentBadgeDot,
                            { transform: [{ scale: liveDotAnim }] },
                          ]}
                        />
                        <Text style={styles.currentBadgeText}>CURRENT</Text>
                      </View>
                      <View
                        style={[
                          styles.xpBadge,
                          isHovered && { transform: [{ scale: 1.08 }] },
                        ]}
                      >
                        <Feather name="award" size={10} color="#d97706" style={{ marginRight: 2 }} />
                        <Text style={styles.xpBadgeText}>+{item.xpReward} XP</Text>
                      </View>
                    </>
                  )}
                  <Text style={[styles.milestoneNumberMobile, { color: numberColor }]}>
                    {item.number}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.milestoneTitleMobile,
                    { textAlign: 'right' },
                    isLocked && styles.milestoneTitleLocked,
                    isHovered && !isLocked && styles.milestoneTitleHovered,
                    pressed && !isLocked && { color: '#0040C1' },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.milestoneSessionTimeMobile,
                    { textAlign: 'right' },
                    isLocked && styles.milestoneSessionTimeLocked,
                  ]}
                >
                  {item.sessionTime}
                </Text>
              </View>

              {isAvailable ? (
                <ActiveBeaconHalo size={62} color={numberColor} showStartBadge={false}>
                  {renderNodeContent(pressed)}
                </ActiveBeaconHalo>
              ) : (
                renderNodeContent(pressed)
              )}
            </>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainScrollDesktop: {
    marginLeft: 0,
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90, // room for mobile tabs (matches home/dashboard)
  },
  mainScrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 16,
    paddingBottom: 24,
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },

  /* Desktop Header */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headingTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 30,
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headingSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 14.5,
    color: '#64748B',
    marginTop: 3,
  },

  /* User Badge Row — now handled by <UserLevelBadge /> */

  /* Mobile Fixed Top Bar (Pinned at top) */
  mobileFixedTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0F172A',
  },
  brandAccent: {
    color: '#0057FF',
  },
  brandTaglineMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#94a3b8',
  },
  mobileHeadingSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  headingTitleMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headingSubtitleMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },

  /* Desktop Roadmap Track (Matches Image 2 reference, 100% full width) */
  roadmapTrackContainerDesktop: {
    position: 'relative',
    width: '100%',
    height: 680,
    marginTop: 20,
  },
  desktopCardSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  milestoneCardDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 360,
    gap: 18,
    paddingVertical: 4,
  },
  haloCircleDesktop: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.04)',
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  innerIconCircleDesktop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        }),
  },

  /* ==================================================================== */
  /* MOBILE SERPENTINE ROADMAP STYLING (FLOATING NODES, NO CARD BOX)     */
  /* ==================================================================== */
  mobileRoadmapContainer: {
    position: 'relative',
    width: '100%',
    height: 820,
    marginTop: 8,
  },
  mobileNodeSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  mobileMilestoneNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
  },
  mobileMilestoneNodeLeft: {
    gap: 12,
  },
  mobileMilestoneNodeRight: {
    gap: 12,
  },
  haloCircleMobile: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.04)',
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  innerIconCircleMobile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        }),
  },
  checkBadgeWrapperMobile: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  mobileNodeTextCol: {
    flexShrink: 1,
    flex: 1,
    maxWidth: 210,
  },
  numberBadgeRowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  milestoneNumberMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    letterSpacing: 0.1,
  },
  milestoneTitleMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13.5,
    color: '#0F172A',
    lineHeight: 17.5,
  },
  milestoneSessionTimeMobile: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Common Components */
  milestoneCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  checkBadgeWrapper: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  milestoneTextCol: {
    flex: 1,
  },
  numberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  milestoneNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    letterSpacing: -0.2,
  },
  completedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  completedBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#10B981',
    letterSpacing: 0.4,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  xpBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#b45309',
    letterSpacing: 0.2,
  },
  milestoneTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
    lineHeight: 22,
  },
  milestoneSessionTime: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  /* Locked State Visuals */
  milestoneCardLocked: {
    opacity: 0.65,
  },
  mobileMilestoneNodeLocked: {
    opacity: 0.65,
  },
  innerIconCircleLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  lockBadgeWrapperDesktop: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.08)' } as any)
      : { elevation: 2 }),
  },
  lockBadgeWrapperMobile: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.08)' } as any)
      : { elevation: 2 }),
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#64748B',
    letterSpacing: 0.3,
  },
  milestoneTitleLocked: {
    color: '#64748B',
  },
  milestoneSessionTimeLocked: {
    color: '#94A3B8',
  },

  /* Active Available Milestone Visuals */
  haloCircleAvailable: {
    borderWidth: 2,
  },
  haloCircleAvailableMobile: {
    borderWidth: 2,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  currentBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0057FF',
  },
  currentBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#0057FF',
    letterSpacing: 0.4,
  },

  /* Hover & Spring Transitions */
  haloCircleHovered: {
    ...(Platform.OS === 'web'
      ? ({
          transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease',
        } as any)
      : {}),
  },
  milestoneCardHovered: {
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
        } as any)
      : {}),
  },
  milestoneTitleHovered: {
    color: '#0057FF',
  },
  /* Roadmap Status & Empty States */
  roadmapStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  roadmapStatusText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 15,
    color: '#64748B',
    marginTop: 14,
  },
  roadmapEmptyIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  roadmapEmptyTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 8,
  },
  roadmapEmptyText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 20,
  },
});
