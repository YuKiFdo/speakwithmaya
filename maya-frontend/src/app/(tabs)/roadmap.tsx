import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

// import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, SvgXml, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import { getBackendBaseUrl } from '@/utils/backend-url';
import { apiClient } from '@/utils/api-client';
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
  RoadmapLockIcon,
} from '@/components/icons/roadmap-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { MobileTopBar } from '@/components/navigation/mobile-top-bar';
import { DesktopTopBar } from '@/components/navigation/desktop-top-bar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { RoadmapTrackSkeleton } from '@/components/ui/skeleton';
import { MissionCardModal } from '@/components/roadmap/mission-card-modal';
import { ScenarioBriefingModal, resolveScenarioBriefingData } from '@/components/roadmap/scenario-briefing-modal';
import { useOnboardingStore, OnboardingStore } from '@/services/store/onboarding-store';
import { CallSessionStore } from '@/services/store/call-session-store';
import { useUserStats } from '@/hooks/useUserStats';
import { paymentApi } from '@/services/payment/payment-api';
import { mayaAlert } from '@/components/ui/alert-modal';
import { authService } from '@/services/auth/auth-service';
import {
  RoadmapGlowParticles,
  buildDesktopPathSegments,
  buildMobilePathSegments,
} from '@/components/roadmap/roadmap-particles';

export interface MilestoneItem {
  id: string;
  levelNumber: number;
  number: string;
  title: string;
  description?: string;
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
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  userRole?: string;
  mayaRole?: string;
  goalTitle?: string;
  goalDescription?: string;
  isScenarioMode?: boolean;
  ttsScriptEnglish?: string;
  ttsScriptSinhala?: string;
  audioUrlEnglish?: string;
  audioUrlSinhala?: string;
}


/* -------------------------------------------------------------------------- */
/*  Security / robustness helpers                                             */
/* -------------------------------------------------------------------------- */

/** Backend colours go into styles (and a CSS box-shadow string on web): accept hex only. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

/**
 * Level icons are admin-authored SVG strings from the backend. Treat them as untrusted:
 * only plain shape SVG is allowed. Anything with scripts, event handlers, external
 * references, embedded HTML or entity tricks is dropped (the default icon is used).
 */
const MAX_SVG_LENGTH = 20000;
const UNSAFE_SVG =
  /<\s*(script|foreignObject|iframe|object|embed|image|use|animate|set|style|a)\b|\son\w+\s*=|javascript:|data:|<!ENTITY|<!DOCTYPE|(?:xlink:)?href\s*=\s*["']\s*(?!#)/i;
function sanitizeSvg(svg?: string | null): string {
  if (typeof svg !== 'string') return '';
  const s = svg.trim();
  if (!s || s.length > MAX_SVG_LENGTH) return '';
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(s)) return '';
  if (UNSAFE_SVG.test(s)) return '';
  return s;
}

// In-memory cache, tied to the account that produced it so a second account on the
// same device never sees the previous account's progress.
let cachedRoadmapMilestones: MilestoneItem[] | null = null;
let cachedRoadmapOwner: string | null = null;

function getInitialMilestones(owner: string): MilestoneItem[] {
  return cachedRoadmapOwner === owner &&
    cachedRoadmapMilestones &&
    cachedRoadmapMilestones.length > 0
    ? cachedRoadmapMilestones
    : [];
}

export default function RoadmapScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const stats = useUserStats();
  const displayName = stats.displayName || params.name || 'Learner';
  const { isPhone } = useBreakpoint();
  const onboardingState = useOnboardingStore();
  const ownerKey = String(
    (onboardingState.user as any)?.id ?? (onboardingState.user as any)?.email ?? 'anon',
  );
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<DashboardTab>('roadmap');
  const isPro = stats.isPro;
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);
  const [lockedTargetLevel, setLockedTargetLevel] = useState<MilestoneItem | null>(null);
  const [selectedMission, setSelectedMission] = useState<MilestoneItem | null>(null);

  const lastActivePopupRef = useRef<PopupPreset>('level-locked');
  const lastLockedTargetRef = useRef<MilestoneItem | null>(null);

  const insets = useSafeAreaInsets();
const scrollRef = useRef<ScrollView>(null);
const scrollMetrics = useRef({ y: 0, viewH: 0, contentH: 0 });
const [showScrollHint, setShowScrollHint] = useState(false);
const [showScrollTop, setShowScrollTop] = useState(false);

// The scroll content ends with ~170px of blank padding, so hide the hint
// a bit before the true bottom
const HIDE_WHEN_REMAINING_BELOW = 200;
const SCROLL_TOP_THRESHOLD = 350;
const MOBILE_TAB_BAR_HEIGHT = 62;

const updateScrollHint = useCallback(() => {
  const { y, viewH, contentH } = scrollMetrics.current;
  if (!viewH || !contentH) return;
  const remaining = contentH - (y + viewH);
  setShowScrollHint(remaining > HIDE_WHEN_REMAINING_BELOW);
  setShowScrollTop(y > SCROLL_TOP_THRESHOLD);
}, []);

const handleScrollHintPress = useCallback(() => {
  const { y, viewH } = scrollMetrics.current;
  scrollRef.current?.scrollTo({ y: y + viewH * 0.8, animated: true });
}, []);

const handleScrollTopPress = useCallback(() => {
  scrollRef.current?.scrollTo({ y: 0, animated: true });
}, []);

// Sits above the mobile tab bar; flush with the bottom on desktop
const hintBottomOffset = isDesktop
  ? 0
  : MOBILE_TAB_BAR_HEIGHT + Math.max(insets.bottom, 6) - insets.bottom;

const scrollTopBottomOffset = isDesktop
  ? 24
  : MOBILE_TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 12;

  if (activePopup) {
    lastActivePopupRef.current = activePopup;
  }
  if (lockedTargetLevel) {
    lastLockedTargetRef.current = lockedTargetLevel;
  }

  const effectivePopup = activePopup || lastActivePopupRef.current;
  const effectiveLockedLevel = lockedTargetLevel || lastLockedTargetRef.current;
  const isLevelLocked = effectivePopup === 'level-locked';

  const [milestones, setMilestones] = useState<MilestoneItem[]>(() => getInitialMilestones(ownerKey));
  const [isLoadingLevels, setIsLoadingLevels] = useState<boolean>(
    () => getInitialMilestones(ownerKey).length === 0,
  );
  const [loadError, setLoadError] = useState(false);

  // Fetch published levels from backend & sync student unlocked status
  const fetchRoadmapData = useCallback(async (isSilentBackground: boolean = false) => {
    try {
      // Never show another account's cached progress
      if (cachedRoadmapOwner !== ownerKey) {
        cachedRoadmapMilestones = null;
        cachedRoadmapOwner = null;
        setMilestones([]);
      }
      if (!isSilentBackground && !cachedRoadmapMilestones) {
        setIsLoadingLevels(true);
      }
      setLoadError(false);

      // In parallel via Axios
      const [roadmapRes, sessionsResult, progressRes] = await Promise.all([
        apiClient.get('/v1/roadmap').catch((err) => {
          if (__DEV__) console.warn('[Roadmap] get /v1/roadmap error:', err?.message || err);
          return null;
        }),
        fetchAllPracticeSessions().catch((err) => {
          if (__DEV__) console.warn('[Roadmap] fetchAllPracticeSessions caught:', err);
          return [];
        }),
        apiClient.get('/v1/roadmap/user-progress').catch((err) => {
          if (__DEV__) console.warn('[Roadmap] get /v1/roadmap/user-progress error:', err?.message || err);
          return null;
        }),
      ]);

      const sessions: any = sessionsResult;

      let backendLevels: any[] = [];
      const rawData = roadmapRes?.data;
      if (Array.isArray(rawData?.levels) && rawData.levels.length > 0) {
        backendLevels = rawData.levels;
      } else if (Array.isArray(rawData) && rawData.length > 0) {
        backendLevels = rawData;
      }

      if (backendLevels.length === 0) {
        if (!cachedRoadmapMilestones || cachedRoadmapMilestones.length === 0) {
          setLoadError(true);
        }
        return;
      }

      const sourceLevels = backendLevels;

      // Determine which levels the student has genuinely completed (Authoritative source: Supabase DB)
      const completedLevelIds = new Set<string>();
      const completedLevelNumbers = new Set<number>();

      // 1. Fetch real user level completions directly from user_roadmap_progress backend table (Supabase DB)
      const progressData = progressRes?.data;
      if (progressData) {
        if (Array.isArray(progressData.completedLevelIds)) {
          progressData.completedLevelIds.forEach((id: string) => completedLevelIds.add(id));
        }
        if (Array.isArray(progressData.completedLevelNumbers)) {
          progressData.completedLevelNumbers.forEach((num: number) => completedLevelNumbers.add(num));
        }
      }

      // 2. Cross-reference with completed sessions recorded in Supabase sessions table
      if (Array.isArray(sessions)) {
        sessions.forEach((s: any) => {
          if (s.status === 'completed' && s.roadmap_level_id) {
            completedLevelIds.add(s.roadmap_level_id);
            sourceLevels.forEach((lvl: any, idx: number) => {
              const lvlNum = lvl.levelNumber ?? idx + 1;
              if (
                s.roadmap_level_id === lvl.id ||
                s.roadmap_level_id === `lvl-${lvlNum}` ||
                s.roadmap_level_id === `lvl-0${lvlNum}` ||
                s.roadmap_level_id === String(lvlNum)
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

        const isStarter = (stats.planTier || 'starter').toLowerCase() === 'starter';

        if (isThisLevelCompleted) {
          status = 'completed';
        } else if (stats.isTestAccount) {
          status = 'in-progress';
        } else if (isStarter && levelNum > 1) {
          // Starter plan users are strictly locked to Level 1 only
          status = 'locked';
        } else if (levelNum === 1 || isPrevLevelCompleted) {
          status = 'in-progress';
        } else {
          status = 'locked';
        }

        const rawPoints = lvl.practice_points || lvl.practicePoints || (Array.isArray(lvl.learningObjectives) ? lvl.learningObjectives.map((o: any) => o.title || o) : []);
        const practicePoints: string[] = Array.isArray(rawPoints)
          ? rawPoints.map((p: any) => (typeof p === 'string' ? p : p.title || String(p)))
          : [];

        const durationMins = lvl.durationMins || lvl.duration_mins || (levelNum <= 2 ? 5 : 10);

        return {
          id: lvl.id || `lvl-${levelNum}`,
          levelNumber: levelNum,
          number: String(levelNum).padStart(2, '0'),
          title: String(lvl.title ?? '').slice(0, 120),
          description: lvl.description || lvl.scenario_briefing || '',
          sessionTime: `Session time · ${durationMins} min`,
          xpReward: lvl.xpReward || 50 + idx * 25,
          status,
          iconType: lvl.iconType || 'chat',
          customSvg: sanitizeSvg(lvl.customSvg),
          numberColor: safeColor(lvl.numberColor, '#0057FF'),
          haloColor: safeColor(lvl.haloColor, '#EFF6FF'),
          haloBorderColor: safeColor(lvl.haloBorderColor, '#BFDBFE'),
          innerBg: '#FFFFFF',
          topic: lvl.topic,
          scenarioId: lvl.scenarioId,
          practicePoints,
          canonicalContent: lvl.canonicalContent || lvl.canonical_content || '',
          passingScorePercent: lvl.passingScorePercent || lvl.passing_score_percent || 70,
          scenarioPrompt: lvl.scenario_prompt || lvl.scenarioPrompt || '',
          openingMode: lvl.opening_mode || lvl.openingMode || 'maya_explains_first',
          openingLine: lvl.opening_line || lvl.openingLine || '',
          scenarioBriefing: lvl.scenario_briefing || lvl.scenarioBriefing || lvl.description || '',
          emotionTags: lvl.emotion_tags || lvl.emotionTags || ['neutral'],
          userRole: lvl.user_role || lvl.userRole || '',
          mayaRole: lvl.maya_role || lvl.mayaRole || '',
          goalTitle: lvl.goal_title || lvl.goalTitle || '',
          goalDescription: lvl.goal_description || lvl.goalDescription || '',
          isScenarioMode: lvl.is_scenario_mode ?? lvl.isScenarioMode ?? true,
          ttsScriptEnglish: lvl.tts_script_english || lvl.ttsScriptEnglish || '',
          ttsScriptSinhala: lvl.tts_script_sinhala || lvl.ttsScriptSinhala || '',
          audioUrlEnglish: lvl.audio_url_english || lvl.audioUrlEnglish || '',
          audioUrlSinhala: lvl.audio_url_sinhala || lvl.audioUrlSinhala || '',
        };
      });

      cachedRoadmapMilestones = mappedMilestones;
      cachedRoadmapOwner = ownerKey;
      setLoadError(false);
      setMilestones(mappedMilestones);
    } catch (e: any) {
      if (__DEV__) {
        console.warn('[Roadmap] Error fetching dynamic roadmap data:', e);
        console.warn('[Roadmap] Stack:', e?.stack);
      }
      if (!cachedRoadmapMilestones || cachedRoadmapMilestones.length === 0) setLoadError(true);
    } finally {
      setIsLoadingLevels(false);
    }
  }, [stats.isTestAccount, stats.planTier, ownerKey]);

  useEffect(() => {
    // Clean up any old cached storage so Supabase DB is always the sole authority
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('maya_cached_completed_levels');
      } catch {}
    }
    // If we already have cached milestones in memory, fetch in the background silently
    // without triggering skeleton flash or freezing user interactions
    fetchRoadmapData(getInitialMilestones(ownerKey).length > 0);
  }, [fetchRoadmapData]);



  // Responsive full-width calculations for desktop track & milestone columns:
  const [layoutTrackWidth, setLayoutTrackWidth] = useState<number | null>(null);
  const trackWidth = layoutTrackWidth ?? (isDesktop ? Math.max(900, windowWidth - 340) : windowWidth - 40);

  const xLeft = 40;
  const xRight = Math.max(860, trackWidth - 40);
  const R = 90;
  const desktopYStart = 200;
  const desktopRowStep = 225;
  const lastIdx = milestones.length - 1;
  const finalR = Math.max(0, Math.floor(lastIdx / 2));
  const finalCol = lastIdx >= 0 ? lastIdx % 2 : 0;
  const desktopRowCount = finalR + 1;
  const desktopTrackHeight = desktopYStart + finalR * desktopRowStep + 100;

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
          if (desktopRowStep > 2 * R) {
            desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight} ${yRow + R} L ${xRight} ${yNext - R} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
          } else {
            desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
          }
        }
      } else if (r % 2 === 1) {
        if (isFinalRow) {
          const targetX = finalCol === 0 ? col2X : col1X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          if (desktopRowStep > 2 * R) {
            desktopSvgPath += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft} ${yRow + R} L ${xLeft} ${yNext - R} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext}`;
          } else {
            desktopSvgPath += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext}`;
          }
        }
      } else {
        if (isFinalRow) {
          const targetX = finalCol === 0 ? col1X : col2X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          if (desktopRowStep > 2 * R) {
            desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight} ${yRow + R} L ${xRight} ${yNext - R} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
          } else {
            desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
          }
        }
      }
    }
  }

  // Calculate highest completed milestone index
  let highestCompletedIdx = -1;
  milestones.forEach((m, idx) => {
    if (m.status === 'completed') {
      highestCompletedIdx = Math.max(highestCompletedIdx, idx);
    }
  });

  // Glowing progress line connects through all completed levels (and leads to the active in-progress level)
  const targetCompletedProgressIdx =
    highestCompletedIdx >= 0
      ? (highestCompletedIdx === milestones.length - 1 ? highestCompletedIdx : highestCompletedIdx + 1)
      : -1;

  const getDesktopPathUpTo = (targetIdx: number): string => {
    if (targetIdx <= 0 || milestones.length <= 1) return '';
    const clampedTarget = Math.min(targetIdx, milestones.length - 1);

    let path = `M ${col1X} ${desktopYStart}`;

    for (let i = 0; i < clampedTarget; i++) {
      const r = Math.floor(i / 2);
      const yRow = desktopYStart + r * desktopRowStep;
      const yNext = desktopYStart + (r + 1) * desktopRowStep;

      if (i % 2 === 0) {
        if (r % 2 === 0) {
          path += ` L ${col2X} ${yRow}`;
        } else {
          path += ` L ${col1X} ${yRow}`;
        }
      } else {
        if (r % 2 === 0) {
          if (desktopRowStep > 2 * R) {
            path += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight} ${yRow + R} L ${xRight} ${yNext - R} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext} L ${col2X} ${yNext}`;
          } else {
            path += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext} L ${col2X} ${yNext}`;
          }
        } else {
          if (desktopRowStep > 2 * R) {
            path += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft} ${yRow + R} L ${xLeft} ${yNext - R} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext} L ${col1X} ${yNext}`;
          } else {
            path += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext} L ${col1X} ${yNext}`;
          }
        }
      }
    }
    return path;
  };

  const desktopCompletedSvgPath = targetCompletedProgressIdx > 0 ? getDesktopPathUpTo(targetCompletedProgressIdx) : '';

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

  const getMobilePathUpTo = (targetIdx: number): string => {
    if (targetIdx <= 0 || milestones.length <= 1) return '';
    const clampedTarget = Math.min(targetIdx, milestones.length - 1);

    let path = `M ${mobileIconLeftX} ${mobileYTrack1}`;
    for (let step = 0; step < clampedTarget; step++) {
      const yCurrent = mobileYTrack1 + step * mobileTierHeight;
      const yNext = mobileYTrack1 + (step + 1) * mobileTierHeight;

      if (step % 2 === 0) {
        // From left to right on tier 'step', then curve down right arc to tier 'step + 1'
        path += ` L ${mobileIconRightX} ${yCurrent} A ${mobileR} ${mobileR} 0 0 1 ${mobileIconRightX} ${yNext}`;
      } else {
        // From right to left on tier 'step', then curve down left arc to tier 'step + 1'
        path += ` L ${mobileIconLeftX} ${yCurrent} A ${mobileR} ${mobileR} 0 0 0 ${mobileIconLeftX} ${yNext}`;
      }
    }
    return path;
  };

  const mobileCompletedSvgPath = targetCompletedProgressIdx > 0 ? getMobilePathUpTo(targetCompletedProgressIdx) : '';

  // Parametric geometry segments for Desktop Traveling Glow Particles
  const { segments: desktopSegments, totalLen: desktopTotalLen } = useMemo(() => {
    return buildDesktopPathSegments(
      targetCompletedProgressIdx,
      col1X,
      col2X,
      desktopYStart,
      desktopRowStep,
      xRight,
      xLeft,
      R
    );
  }, [targetCompletedProgressIdx, col1X, col2X, desktopYStart, desktopRowStep, xRight, xLeft, R]);

  // Parametric geometry segments for Mobile Traveling Glow Particles
  const { segments: mobileSegments, totalLen: mobileTotalLen } = useMemo(() => {
    return buildMobilePathSegments(
      targetCompletedProgressIdx,
      mobileIconLeftX,
      mobileIconRightX,
      mobileYTrack1,
      mobileTierHeight,
      mobileR
    );
  }, [targetCompletedProgressIdx, mobileIconLeftX, mobileIconRightX, mobileYTrack1, mobileTierHeight, mobileR]);

  const handleSelectTab = (tab: DashboardTab) => {
    // Only forward what the next screen needs (not every URL param), and switch tabs instead of stacking screens
    const navParams = params.name ? { name: params.name } : undefined;
    if (tab === 'home') {
      router.navigate({ pathname: '/dashboard', params: navParams });
    } else if (tab === 'history') {
      router.navigate({ pathname: '/history', params: navParams });
    } else if (tab === 'account') {
      router.navigate({ pathname: '/account', params: navParams });
    } else {
      setActiveTab(tab);
    }
  };

  const currentActiveLevel = useMemo(() => {
    return milestones.find((m) => m.status === 'in-progress') || milestones[0] || null;
  }, [milestones]);

  const handleMilestonePress = (item: MilestoneItem) => {
    if (item.status === 'locked') {
      setLockedTargetLevel(item);
      const isStarter = (stats.planTier || 'starter').toLowerCase() === 'starter';
      if (isStarter && item.levelNumber > 1) {
        setActivePopup('unlock-premium');
      } else {
        setActivePopup('level-locked');
      }
    } else {
      setSelectedMission(item);
    }
  };

  const handleStartMission = (item: MilestoneItem) => {
    setSelectedMission(null);

    if (stats.isSubscriptionLocked) {
      setActivePopup('reactivate-plan');
      return;
    }

    const isStarter = (stats.planTier || 'starter').toLowerCase() === 'starter';
    const minutesBalance = onboardingState.user?.minutesBalance ?? stats.minutesBalance ?? 5;
    if (minutesBalance <= 0) {
      if (isStarter) {
        setActivePopup('daily-limit');
      } else {
        setActivePopup('get-extra-time');
      }
      return;
    }

    const briefingData = resolveScenarioBriefingData(item);

    CallSessionStore.startCall({
      roadmapLevelId: item.id,
      levelNumber: item.levelNumber,
      topic: item.topic || item.title,
      scenarioTitle: item.title,
      scenarioId: item.scenarioId || 'general-practice',
      scenarioPrompt: item.scenarioPrompt,
      openingMode: item.openingMode,
      openingLine: item.openingLine,
      scenarioBriefing: item.scenarioBriefing,
      emotionTags: item.emotionTags,
      userRole: item.userRole || briefingData.userRole,
      mayaRole: item.mayaRole || briefingData.mayaRole,
      goalTitle: item.goalTitle || briefingData.goalTitle,
      goalDescription: item.goalDescription || briefingData.goalDescription,
      practicePoints: item.practicePoints || [],
      canonicalContent: item.canonicalContent || '',
      passingScorePercent: item.passingScorePercent || 70,
      userName: (displayName || onboardingState.user?.displayName || onboardingState.name || 'Learner').trim(),
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

        {/* ==================================================================== */}
        {/* MAIN CONTAINER WITH FIXED MOBILE TOP BAR */}
        {/* ==================================================================== */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR (PINNED) */}
          <MobileTopBar
            pinned
            onLevelPress={() => setActivePopup('level-up')}
          />

          {/* DESKTOP FIXED TOP BAR (PINNED) */}
          <DesktopTopBar
            title="Interactive Roleplays"
            subtitle="Master real-world English through interactive speaking roleplays!"
            levelLabel={stats.levelLabel}
            xpLabel={stats.xpLabel}
            progress={stats.progress}
            isPro={isPro}
            planTier={stats.planTier}
            isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
            onLevelPress={() => setActivePopup('level-up')}
          />

          {/* MAIN SCROLLABLE CONTENT */}
       <ScrollView
  ref={scrollRef}
  style={[styles.mainScroll, isDesktop && styles.mainScrollDesktop]}
  contentContainerStyle={[
    styles.mainScrollContent,
    isDesktop && styles.mainScrollContentDesktop,
  ]}
  showsVerticalScrollIndicator={false}
  scrollEventThrottle={16}
  onScroll={(e) => {
    scrollMetrics.current.y = e.nativeEvent.contentOffset.y;
    updateScrollHint();
  }}
  onLayout={(e) => {
    scrollMetrics.current.viewH = e.nativeEvent.layout.height;
    updateScrollHint();
  }}
  onContentSizeChange={(_, h) => {
    scrollMetrics.current.contentH = h;
    updateScrollHint();
  }}
>
            {/* MOBILE HEADING */}
          {!isDesktop && (
            <View style={styles.mobileHeadingSection}>
              <Text style={styles.headingTitleMobile}>Interactive Roleplays</Text>
              <Text style={styles.headingSubtitleMobile}>
                Master real-world English through interactive speaking roleplays!
              </Text>
            </View>
          )}

          {/* ==================================================================== */}
          {/* ROLEPLAY TRACK & SCENARIOS */}
          {/* ==================================================================== */}
          {isLoadingLevels ? (
            <RoadmapTrackSkeleton
              isDesktop={isDesktop}
              trackWidth={trackWidth}
              mobileWidth={mobileWidth}
            />
          ) : milestones.length === 0 ? (
            <RoadmapEmptyState hasError={loadError} onRetry={() => fetchRoadmapData(false)} />
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

                {/* 5. Stationary Illuminated Progress Track with Ambient Breathing Glow in Place */}
                {desktopCompletedSvgPath ? (
                  <>
                    {/* Ambient Breathing Glow Layers in Place */}
                    <RoadmapGlowParticles
                      svgPath={desktopCompletedSvgPath}
                      totalLen={desktopTotalLen}
                      segments={desktopSegments}
                    />

                    {/* Outer Blue Track Bevel Border */}
                    <Path
                      d={desktopCompletedSvgPath}
                      stroke="rgba(0, 87, 255, 0.25)"
                      strokeWidth="13"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Solid Primary Blue Progress Line - Fills Main Container Full Height */}
                    <Path
                      d={desktopCompletedSvgPath}
                      stroke="#0057FF"
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Subtle Top Surface Highlight */}
                    <Path
                      d={desktopCompletedSvgPath}
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </>
                ) : null}

                {/* Vertical Dotted Drops from Card Icons down to Anchors */}
                {milestones.map((item, idx) => {
                  const r = Math.floor(idx / 2);
                  const isReversedRow = r % 2 === 1;
                  const x = isReversedRow
                    ? (idx % 2 === 0 ? col2X : col1X)
                    : (idx % 2 === 0 ? col1X : col2X);
                  const trackY = desktopYStart + r * desktopRowStep;
                  const dropYStart = 122 + r * desktopRowStep;
                  const isLocked = item.status === 'locked';
                  const isItemCompleted = item.status === 'completed';
                  return (
                    <Line
                      key={`desktop-drop-${idx}`}
                      x1={x}
                      y1={dropYStart}
                      x2={x}
                      y2={trackY}
                      stroke={isLocked ? '#CBD5E1' : isItemCompleted ? '#60A5FA' : '#93C5FD'}
                      strokeWidth="1.8"
                      strokeDasharray="3,3"
                    />
                  );
                })}

                {/* Anchor Dots on the Track (White disc with solid core dot matching design) */}
                {milestones.map((item, idx) => {
                  const r = Math.floor(idx / 2);
                  const isReversedRow = r % 2 === 1;
                  const x = isReversedRow
                    ? (idx % 2 === 0 ? col2X : col1X)
                    : (idx % 2 === 0 ? col1X : col2X);
                  const trackY = desktopYStart + r * desktopRowStep;
                  const isLocked = item.status === 'locked';
                  const isAvailable = item.status === 'in-progress';
                  const isItemCompleted = item.status === 'completed';

                  const innerDotColor = isLocked ? '#64748B' : '#3B82F6';
                  const outerBorderColor = isLocked ? '#CBD5E1' : '#BFDBFE';

                  return (
                    <React.Fragment key={`desktop-dot-${idx}`}>
                      {isAvailable && (
                        <Circle
                          cx={x}
                          cy={trackY}
                          r={15}
                          fill="rgba(59, 130, 246, 0.16)"
                        />
                      )}
                      {/* White outer disc */}
                      <Circle
                        cx={x}
                        cy={trackY}
                        r={11}
                        fill="#FFFFFF"
                        stroke={outerBorderColor}
                        strokeWidth={1.5}
                      />
                      {/* Center core dot */}
                      <Circle
                        cx={x}
                        cy={trackY}
                        r={5}
                        fill={innerDotColor}
                      />
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

                {/* 5. Stationary Illuminated Progress Track with Ambient Breathing Glow in Place */}
                {mobileCompletedSvgPath ? (
                  <>
                    {/* Ambient Breathing Glow Layers in Place */}
                    <RoadmapGlowParticles
                      svgPath={mobileCompletedSvgPath}
                      totalLen={mobileTotalLen}
                      segments={mobileSegments}
                    />

                    {/* Outer Blue Track Bevel Border */}
                    <Path
                      d={mobileCompletedSvgPath}
                      stroke="rgba(0, 87, 255, 0.25)"
                      strokeWidth="13"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Solid Primary Blue Progress Line - Fills Main Container Full Height */}
                    <Path
                      d={mobileCompletedSvgPath}
                      stroke="#0057FF"
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Subtle Top Surface Highlight */}
                    <Path
                      d={mobileCompletedSvgPath}
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </>
                ) : null}

                {/* Vertical Dotted Drops from Card Avatar bottom down to Track Dots */}
                {milestones.map((item, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  const yStart = yTrack - mobileYDropLen;
                  const isLocked = item.status === 'locked';
                  const isItemCompleted = item.status === 'completed';
                  return (
                    <Line
                      key={`mobile-drop-${idx}`}
                      x1={x}
                      y1={yStart}
                      x2={x}
                      y2={yTrack}
                      stroke={isLocked ? '#CBD5E1' : isItemCompleted ? '#60A5FA' : '#93C5FD'}
                      strokeWidth="1.8"
                      strokeDasharray="3,3"
                    />
                  );
                })}

                {/* Mobile Anchor Dots on Track (White disc with solid core dot matching design) */}
                {milestones.map((item, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  const isLocked = item.status === 'locked';
                  const isAvailable = item.status === 'in-progress';
                  const isItemCompleted = item.status === 'completed';

                  const innerDotColor = isLocked ? '#64748B' : '#3B82F6';
                  const outerBorderColor = isLocked ? '#CBD5E1' : '#BFDBFE';

                  return (
                    <React.Fragment key={`mobile-dot-${idx}`}>
                      {isAvailable && (
                        <Circle
                          cx={x}
                          cy={yTrack}
                          r={13}
                          fill="rgba(59, 130, 246, 0.16)"
                        />
                      )}
                      {/* White outer disc */}
                      <Circle
                        cx={x}
                        cy={yTrack}
                        r={9}
                        fill="#FFFFFF"
                        stroke={outerBorderColor}
                        strokeWidth={1.5}
                      />
                      {/* Center core dot */}
                      <Circle
                        cx={x}
                        cy={yTrack}
                        r={4}
                        fill={innerDotColor}
                      />
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
                        // Definite width: on native a shrink-wrapped absolute row gives the flex:1
                        // text column 0px, so titles were squeezed or invisible
                        width: Math.max(160, mobileWidth - (mobileIconLeftX - mobileIconSize / 2) - 8),
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

<ScrollDownHint
  visible={showScrollHint && !isLoadingLevels && milestones.length > 0}
  bottomOffset={hintBottomOffset}
  onPress={handleScrollHintPress}
/>

<ScrollTopButton
  visible={showScrollTop && !isLoadingLevels && milestones.length > 0}
  bottomOffset={scrollTopBottomOffset}
  onPress={handleScrollTopPress}
/>
      </View>



        {/* ==================================================================== */}
        {/* POPUP MODAL */}
        {/* ==================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={effectivePopup}
          levelNumber={effectiveLockedLevel?.levelNumber || stats.currentLevelNumber}
          title={
            isLevelLocked
              ? 'Level Locked'
              : activePopup === 'level-up'
              ? 'Your Level Progress'
              : undefined
          }
          titleHighlight={isLevelLocked ? 'Locked' : undefined}
          subtitle={
            isLevelLocked && effectiveLockedLevel
              ? `Complete Level ${Math.max(1, (effectiveLockedLevel.levelNumber ?? 2) - 1)} first to unlock this session and keep moving forward on your journey.`
              : activePopup === 'level-up'
              ? `You are currently on ${stats.levelLabel} with ${stats.xpLabel}.\nKeep completing roleplay lessons to reach Level ${stats.currentLevelNumber + 1}!`
              : undefined
          }
          primaryButtonText={
            isLevelLocked
              ? currentActiveLevel
                ? `Go to Level ${currentActiveLevel.levelNumber}`
                : 'Got It'
              : activePopup === 'level-up'
              ? 'Keep Learning'
              : undefined
          }
          primaryButtonIcon={isLevelLocked ? 'play' : undefined}
          showPrimaryArrow={true}
          footerText={
            isLevelLocked
              ? 'Complete each lesson step-by-step to build your speaking fluency.'
              : undefined
          }
          onClose={() => {
            setActivePopup(null);
          }}
          onPrimaryPress={async () => {
            const popupToActOn = activePopup || lastActivePopupRef.current;
            setActivePopup(null);

            if (popupToActOn === 'reactivate-plan' || popupToActOn === 'unlock-premium' || popupToActOn === 'daily-limit') {
              router.push('/upgrade');
            } else if (popupToActOn === 'level-locked') {
              if (currentActiveLevel) {
                setSelectedMission(currentActiveLevel);
              }
            }
          }}
          onFooterButtonPress={async () => {
            const popupToActOn = activePopup || lastActivePopupRef.current;
            setActivePopup(null);

            if (popupToActOn === 'reactivate-plan') {
              if (stats.hasTelcoSubscription) {
                try {
                  const res = await paymentApi.reactivateTelcoSubscription();
                  await stats.refreshStats();
                  if (res.requiresPin) {
                    router.push('/(tabs)/account?reactivatePin=1' as any);
                  } else {
                    await mayaAlert.success(
                      res.message || 'Your mobile airtime subscription has been reactivated successfully!',
                      'Subscription Active'
                    );
                  }
                } catch (err: any) {
                  await mayaAlert.error(err.message || 'Failed to reactivate subscription.', 'Reactivation Error');
                }
              } else {
                router.push('/(tabs)/account?reactivate=1' as any);
              }
              return;
            }

            router.push('/upgrade');
          }}
        />

        {/* ==================================================================== */}
        {/* ROLEPLAY BRIEFING PREVIEW MODAL (ROADMAP POPUP BEFORE FULLSCREEN) */}
        {/* ==================================================================== */}
        <ScenarioBriefingModal
          visible={selectedMission !== null}
          item={selectedMission}
          onClose={() => setSelectedMission(null)}
          onStartRoleplay={handleStartMission}
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
  const cleanSvg = sanitizeSvg(customSvg);
  if (cleanSvg) {
    try {
      const adapted = sanitizeSvg(adaptSvgColor(cleanSvg, color));
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

/**
 * Open empty / error state: no bordered, shadowed card. Just a soft glow, text and one action.
 */
function RoadmapEmptyState({ hasError, onRetry }: { hasError: boolean; onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyGlowOuter}>
        <View style={styles.emptyGlowInner}>
          <Feather name={hasError ? 'wifi-off' : 'message-circle'} size={30} color="#0057FF" />
        </View>
      </View>
      <Text style={styles.emptyTitle}>
        {hasError ? "Couldn't load roleplays" : 'No roleplays yet'}
      </Text>
      <Text style={styles.emptyBody}>
        {hasError
          ? 'Check your connection and try again.'
          : 'New speaking scenarios will show up here as soon as they are published.'}
      </Text>
      {hasError ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Feather name="refresh-cw" size={15} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
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
 * Bottom fade + "Scroll down" pill with a bouncing arrow.
 * Fades in/out with `visible`; tapping it scrolls the list down.
 */
function ScrollDownHint({
  visible,
  bottomOffset,
  onPress,
}: {
  visible: boolean;
  bottomOffset: number;
  onPress: () => void;
}) {
  const fade = React.useRef(new Animated.Value(0)).current;
  const bounce = React.useRef(new Animated.Value(0)).current;
  const useNative = Platform.OS !== 'web';

  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    }).start();
  }, [visible]);

  // Only run the bounce loop while the hint is visible
  React.useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 6,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      bounce.setValue(0);
    };
  }, [visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.scrollHintWrap, { bottom: bottomOffset, opacity: fade }]}
    >
      {/* White fade so content dissolves into the bottom */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="roadmapBottomFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity="0.88" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#roadmapBottomFade)" />
        </Svg>
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.scrollHintPill, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Scroll down to see more levels"
      >
        <Text style={styles.scrollHintText}>Scroll down</Text>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <Feather name="chevrons-down" size={16} color="#0057FF" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Floating right circle chevron up button to scroll back to top.
 * Smoothly scales and fades in when user has scrolled down into the roadmap.
 */
function ScrollTopButton({
  visible,
  bottomOffset,
  onPress,
}: {
  visible: boolean;
  bottomOffset: number;
  onPress: () => void;
}) {
  const anim = React.useRef(new Animated.Value(0)).current;
  const useNative = Platform.OS !== 'web';

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      tension: 65,
      friction: 9,
      useNativeDriver: useNative,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.scrollTopCircleWrap,
        {
          bottom: bottomOffset,
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.scrollTopCircleBtn, pressed && styles.scrollTopCircleBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Scroll to top"
      >
        <Feather name="chevron-up" size={22} color="#0057FF" />
      </Pressable>
    </Animated.View>
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
  const numberColor = isLocked ? '#64748B' : item.numberColor;
  const iconColor = isLocked ? '#8E95A0' : item.numberColor;
  const innerCircleBg = isLocked
    ? '#E2E8F0'
    : item.id === '01' || isCompleted
    ? '#EFF6FF'
    : item.id === '02' || isAvailable
    ? '#FAF5FF'
    : item.haloColor || '#EFF6FF';

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
        isAvailable && (Platform.OS === 'web'
          ? ({ boxShadow: isHovered
                ? `0 0 0 3px #FFFFFF, 0 0 0 6px ${numberColor}, 0 10px 24px ${numberColor}45`
                : `0 0 0 2px #FFFFFF, 0 0 0 4px ${numberColor}, 0 6px 18px ${numberColor}35` } as any)
          : {
              shadowColor: numberColor,
              shadowOffset: { width: 0, height: isHovered ? 6 : 3 },
              shadowOpacity: isHovered ? 0.45 : 0.35,
              shadowRadius: isHovered ? 12 : 8,
              elevation: isHovered ? 7 : 5,
            }),
        !isLocked && (isPressed
          ? { transform: [{ translateY: 2 }, { scale: 0.94 }] }
          : isHovered
          ? { transform: [{ translateY: -4 }, { scale: 1.05 }] }
          : { transform: [{ translateY: 0 }, { scale: 1 }] }),
        isLocked && { transform: [{ translateX: lockShakeAnim }] },
      ]}
    >
      <Animated.View
        style={[
          styles.innerIconCircleDesktop,
          { backgroundColor: innerCircleBg },
          { transform: [{ rotate: iconRotate }] },
        ]}
      >
        {isLocked ? (
          <RoadmapLockIcon size={30} color="#8E95A0" innerBg="#E2E8F0" />
        ) : (
          <MilestoneIcon type={item.iconType} size={32} customSvg={item.customSvg} color={iconColor} />
        )}
      </Animated.View>

      {isCompleted && (
        <Animated.View
          style={[styles.checkBadgeWrapper, { transform: [{ scale: checkBounceAnim }] }]}
        >
          <RoadmapCheckIcon size={22} />
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
            <ActiveBeaconHalo size={88} color={numberColor} showStartBadge={false}>
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
              {isCompleted && (
                <Text style={styles.completedInlineText}>COMPLETED</Text>
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
  const numberColor = isLocked ? '#64748B' : item.numberColor;
  const iconColor = isLocked ? '#8E95A0' : item.numberColor;
  const innerCircleBg = isLocked
    ? '#E2E8F0'
    : item.id === '01' || isCompleted
    ? '#EFF6FF'
    : item.id === '02' || isAvailable
    ? '#FAF5FF'
    : item.haloColor || '#EFF6FF';

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
        isAvailable && (Platform.OS === 'web'
          ? ({ boxShadow: isHovered
                ? `0 0 0 2.5px #FFFFFF, 0 0 0 5px ${numberColor}, 0 8px 18px ${numberColor}45`
                : `0 0 0 2px #FFFFFF, 0 0 0 3.5px ${numberColor}, 0 4px 12px ${numberColor}35` } as any)
          : {
              shadowColor: numberColor,
              shadowOffset: { width: 0, height: isHovered ? 4 : 2 },
              shadowOpacity: isHovered ? 0.45 : 0.35,
              shadowRadius: isHovered ? 10 : 6,
              elevation: isHovered ? 6 : 4,
            }),
        !isLocked && (isPressed
          ? { transform: [{ translateY: 2 }, { scale: 0.94 }] }
          : isHovered
          ? { transform: [{ translateY: -3 }, { scale: 1.05 }] }
          : { transform: [{ translateY: 0 }, { scale: 1 }] }),
        isLocked && { transform: [{ translateX: lockShakeAnim }] },
      ]}
    >
      <Animated.View
        style={[
          styles.innerIconCircleMobile,
          { backgroundColor: innerCircleBg },
          { transform: [{ rotate: iconRotate }] },
        ]}
      >
        {isLocked ? (
          <RoadmapLockIcon size={24} color="#8E95A0" innerBg="#E2E8F0" />
        ) : (
          <MilestoneIcon type={item.iconType} size={24} customSvg={item.customSvg} color={iconColor} />
        )}
      </Animated.View>

      {isCompleted && (
        <Animated.View
          style={[styles.checkBadgeWrapperMobile, { transform: [{ scale: checkBounceAnim }] }]}
        >
          <RoadmapCheckIcon size={18} />
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
                  {isCompleted && (
                    <Text style={styles.completedInlineTextMobile}>COMPLETED</Text>
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
                  {isCompleted && (
                    <Text style={styles.completedInlineTextMobile}>COMPLETED</Text>
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
    paddingHorizontal: 32,
    paddingTop: 24,
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

  /* User Badge Row - now handled by <UserLevelBadge /> */

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
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0px 3px 14px rgba(0, 0, 0, 0.07)',
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  innerIconCircleDesktop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'flex-end',
  },
  haloCircleMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.07)',
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  innerIconCircleMobile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeWrapperMobile: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 1.5,
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
  completedInlineTextMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 10.5,
    color: '#10B981',
    letterSpacing: 0.4,
    marginLeft: 4,
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
    bottom: -2,
    right: -2,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 1.5,
  },
  milestoneTextCol: {
    flex: 1,
  },
  numberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  milestoneNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    letterSpacing: -0.2,
  },
  completedInlineText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    color: '#10B981',
    letterSpacing: 0.5,
    marginLeft: 6,
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
    fontSize: 17,
    color: '#0F172A',
    lineHeight: 23,
    marginTop: 2,
  },
  milestoneSessionTime: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 3,
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
  /* Roadmap empty / error state (open layout, no card) */
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 24,
  },
  emptyGlowOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyGlowInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 21,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#0057FF',
  },
  emptyButtonPressed: {
    opacity: 0.85,
  },
  emptyButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  scrollHintWrap: {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 120,
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingBottom: 14,
  zIndex: 5,
},
scrollHintPill: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 16,
  paddingVertical: 9,
  borderRadius: 999,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#DBEAFE',
  ...(Platform.OS === 'web'
    ? ({ boxShadow: '0px 4px 14px rgba(0, 87, 255, 0.16)', cursor: 'pointer' } as any)
    : {
        shadowColor: '#0057FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 4,
      }),
},
scrollHintText: {
  ...fontStyle('outfit', 'bold'),
  fontSize: 12.5,
  color: '#0057FF',
  letterSpacing: 0.2,
},
scrollTopCircleWrap: {
  position: 'absolute',
  right: 18,
  zIndex: 10,
},
scrollTopCircleBtn: {
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: '#DBEAFE',
  ...(Platform.OS === 'web'
    ? ({
        boxShadow: '0px 6px 18px rgba(0, 87, 255, 0.20), 0px 2px 6px rgba(15, 23, 42, 0.08)',
        cursor: 'pointer',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
      } as any)
    : {
        shadowColor: '#0057FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 10,
        elevation: 6,
      }),
},
scrollTopCircleBtnPressed: {
  opacity: 0.85,
  transform: [{ scale: 0.94 }],
},
});