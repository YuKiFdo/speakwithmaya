import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AmbientGlow } from '@/components/call/ambient-glow';
import { Radii } from '@/theme/tokens';
import { EndCallIcon } from '@/components/icons/call-icons';
import { ToastPill, ToastPillPreset } from '@/components/ui/toast-pill';
import {
  GrammarFeedbackModal,
} from '@/components/call/grammar-feedback-modal';
import { ConversationDisplay } from '@/components/call/conversation-display';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { fontStyle } from '@/theme/fonts';

import { useLiveCall } from '@/hooks/useLiveCall';
import { ConnectingView } from '@/components/call/connecting-view';
import { ContextualCallGuide } from '@/components/call/contextual-call-guide';
import { BeaconRing } from '@/components/call/beacon-ring';
import { MicrophonePermissionPopup } from '@/components/call/microphone-permission-popup';
import { setLatestSessionReport } from '@/utils/session-report-store';
import { HintFloatingButton } from '@/components/call/hint-floating-button';
import { HintSuggestionCard } from '@/components/call/hint-suggestion-card';
import { fetchTranslation, fetchHint, HintResponse } from '@/services/assistance/assistance-service';
import { CommonPopup } from '@/components/ui/common-popup';
import {
  playCallConnectedSound,
  playOtherButtonSound,
} from '@/services/sound/sound-service';
import { CallSessionStore } from '@/services/store/call-session-store';
import { OnboardingStore } from '@/services/store/onboarding-store';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    userName?: string;
    isIntroCall?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    duration?: string;
    durationMinutes?: string;
    languageMode?: 'sinhala' | 'english';
    sinhalaStyle?: 'balanced' | 'deep_guidance';
    aiSuggestions?: string;
    topic?: string;
    scenarioId?: string;
    scenarioTitle?: string;
    roadmapLevelId?: string;
    practicePoints?: string;
    canonicalContent?: string;
    passingScorePercent?: string;
    levelNumber?: string;
    targetSpeakingShare?: string;
    dailyGoal?: string;
  }>();

  const storeConfig = CallSessionStore.getConfig();
  const onboardingState = OnboardingStore.getState();

  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;
  const useNative = Platform.OS !== 'web';

  // Real-time network & connection monitor
  const connection = useConnectionMonitor();

  const isIntro = storeConfig?.isIntroCall ?? (params.isIntroCall === 'true');
  const durationSec = storeConfig?.durationSeconds || (params.duration ? parseInt(params.duration, 10) : 300);
  const targetDuration = isNaN(durationSec) ? 300 : durationSec;
  const aiSug = isIntro ? false : (storeConfig?.aiSuggestions ?? (params.aiSuggestions !== 'false'));
  const langMode = isIntro ? 'sinhala' : (storeConfig?.languageMode || (params.languageMode === 'english' ? 'english' : 'sinhala'));
  const sinhalaStyle: 'balanced' | 'deep_guidance' = isIntro
    ? 'balanced'
    : (storeConfig?.sinhalaStyle || (params.sinhalaStyle === 'deep_guidance' ? 'deep_guidance' : 'balanced'));
  const effectiveTopic = storeConfig?.topic || params.topic || params.goal || onboardingState.goal || 'General Speaking Practice';
  const effectiveUserName = (storeConfig?.userName || onboardingState.user?.displayName || onboardingState.name || params.name || params.userName || '').trim() || 'Learner';

  let parsedPracticePoints: string[] = storeConfig?.practicePoints || [];
  if (parsedPracticePoints.length === 0 && params.practicePoints) {
    try {
      parsedPracticePoints = JSON.parse(params.practicePoints);
    } catch {}
  }

  const effectiveScenarioId = storeConfig?.scenarioId || params.scenarioId;
  const effectiveRoadmapLevelId = storeConfig?.roadmapLevelId || params.roadmapLevelId;
  const effectiveLevelNumber = storeConfig?.levelNumber ?? (params.levelNumber ? parseInt(params.levelNumber, 10) : undefined);
  const effectiveLevelTitle = storeConfig?.scenarioTitle || params.scenarioTitle || params.topic;
  const effectiveCanonicalContent = storeConfig?.canonicalContent || params.canonicalContent;
  const effectivePassingScorePercent = storeConfig?.passingScorePercent ?? (params.passingScorePercent ? parseInt(params.passingScorePercent, 10) : 75);
  const effectiveTargetSpeakingShare = storeConfig?.targetSpeakingShare ?? (params.targetSpeakingShare ? parseInt(params.targetSpeakingShare, 10) : 40);

  // Core Gemini Live Audio & Call Engine
  const liveCall = useLiveCall({
    topic: effectiveTopic,
    goal: storeConfig?.goal || params.goal || onboardingState.goal,
    level: storeConfig?.level || params.level || onboardingState.level || 'Intermediate',
    durationSeconds: targetDuration,
    languageMode: langMode,
    sinhalaStyle,
    aiSuggestions: aiSug,
    scenarioId: effectiveScenarioId,
    userName: effectiveUserName,
    isIntroCall: isIntro,
    challenge: storeConfig?.challenge || params.challenge || onboardingState.challenge,
    dailyGoal: storeConfig?.dailyGoal || params.dailyGoal || (onboardingState.dailyGoalMinutes ? `${onboardingState.dailyGoalMinutes}-min` : '10-min'),
    roadmapLevelId: effectiveRoadmapLevelId,
    levelNumber: effectiveLevelNumber,
    levelTitle: effectiveLevelTitle,
    practicePoints: parsedPracticePoints,
    canonicalContent: effectiveCanonicalContent,
    passingScorePercent: effectivePassingScorePercent,
    targetSpeakingShare: effectiveTargetSpeakingShare,
    hintsUsedCount: () => hintsHistoryRef.current.length,
  });

  const liveCallRef = useRef(liveCall);
  useEffect(() => {
    liveCallRef.current = liveCall;
  }, [liveCall]);

  // Ensure browser URL bar displays clean route with zero query leakage on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Document title and beforeunload safety guard on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Maya AI — Live Voice Practice';
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (liveCall.status === 'speaking' || liveCall.status === 'listening' || liveCall.status === 'connecting' || liveCall.status === 'reconnecting') {
          e.preventDefault();
          e.returnValue = 'You have an active English speaking session. Are you sure you want to leave?';
          return e.returnValue;
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [liveCall.status]);

  // Auto-start Gemini Live call session on component mount with cleanup on unmount
  useEffect(() => {
    liveCall.startCall();
    return () => {
      liveCallRef.current.endCall(false);
    };
  }, []);

  // Translation & Conversational Hint State
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [translationText, setTranslationText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const [hintData, setHintData] = useState<HintResponse | null>(null);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const hintsHistoryRef = useRef<string[]>([]);
  const lastPrefetchedHintPromptRef = useRef<string>('');
  const isFetchingHintRef = useRef<boolean>(false);

  const translationTargetPromptRef = useRef<string>('');
  const pendingTranslationAfterSpeakingRef = useRef<boolean>(false);

  // 1. Whenever Maya starts speaking a new response, automatically hide translation and hint
  useEffect(() => {
    if (liveCall.status === 'speaking') {
      setIsTranslationVisible(false);
      setTranslationText('');
      setIsTranslating(false);
      pendingTranslationAfterSpeakingRef.current = false;
      translationTargetPromptRef.current = '';

      setIsHintVisible(false);
      setHintData(null);
      lastPrefetchedHintPromptRef.current = '';
      isFetchingHintRef.current = false;
    }
  }, [liveCall.status]);

  // 2. If the user tapped "[ Show Translation ]" while Maya was still speaking,
  // fetch the complete sentence once Maya finishes speaking and enters 'listening'
  useEffect(() => {
    if (liveCall.status === 'listening' && pendingTranslationAfterSpeakingRef.current) {
      pendingTranslationAfterSpeakingRef.current = false;
      const targetPrompt = (liveCall.subtitles || '').trim() || (liveCall.previousSubtitles || '').trim();
      if (targetPrompt) {
        translationTargetPromptRef.current = targetPrompt;
        setIsTranslating(true);
        fetchTranslation(targetPrompt).then((res) => {
          const currentActive = (liveCall.subtitles || '').trim() || (liveCall.previousSubtitles || '').trim();
          if (targetPrompt === currentActive && res) {
            setTranslationText(res);
          }
          setIsTranslating(false);
        });
      } else {
        setIsTranslating(false);
      }
    }
  }, [liveCall.status, liveCall.subtitles, liveCall.previousSubtitles]);

  // 3. User explicitly presses "[ Show Translation ]" / "[ Hide Translation ]"
  const handleToggleTranslation = async () => {
    playOtherButtonSound();
    if (isTranslationVisible) {
      setIsTranslationVisible(false);
      return;
    }

    setIsTranslationVisible(true);
    const targetPrompt = (liveCall.subtitles || '').trim() || (liveCall.previousSubtitles || '').trim();
    if (!targetPrompt) return;

    if (translationText && translationTargetPromptRef.current === targetPrompt) {
      return;
    }

    if (liveCall.status === 'speaking') {
      setIsTranslating(true);
      pendingTranslationAfterSpeakingRef.current = true;
      return;
    }

    translationTargetPromptRef.current = targetPrompt;
    setIsTranslating(true);
    const res = await fetchTranslation(targetPrompt);
    const currentActive = (liveCall.subtitles || '').trim() || (liveCall.previousSubtitles || '').trim();
    if (targetPrompt === currentActive && res) {
      setTranslationText(res);
    }
    setIsTranslating(false);
  };

  // Timer & Farewell logic
  const hasTriggeredFarewellRef = useRef(false);
  const farewellGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTimeUp = liveCall.secondsElapsed >= targetDuration && liveCall.secondsElapsed > 0;

  const displayedElapsed = Math.min(liveCall.secondsElapsed, targetDuration);
  const remainingSeconds = Math.max(0, targetDuration - displayedElapsed);
  const isFarewellPhase = isTimeUp && hasTriggeredFarewellRef.current;
  const [isConcludingCall, setIsConcludingCall] = useState(false);

  const isWrappingUp = isConcludingCall || isFarewellPhase || isTimeUp || liveCall.status === 'ended';

  useEffect(() => {
    if (isWrappingUp) {
      setIsHintVisible(false);
      setHintData(null);
    }
  }, [isWrappingUp]);

  const handleToggleHint = async () => {
    if (isWrappingUp) {
      setIsHintVisible(false);
      return;
    }

    liveCall.suppressMicFor?.(1400);

    if (isHintVisible) {
      setIsHintVisible(false);
      return;
    }

    if (hintData) {
      setIsHintVisible(true);
      return;
    }

    if (isFetchingHintRef.current) return;

    const question = (liveCall.subtitles || '').trim() || (liveCall.previousSubtitles || '').trim() || effectiveTopic;
    if (!question || question.length < 3) return;

    isFetchingHintRef.current = true;
    try {
      const res = await fetchHint(question, {
        topic: effectiveTopic,
        level: params.level,
        scenarioId: params.scenarioId,
        userName: effectiveUserName,
        sessionId: liveCall.sessionId,
      });

      if (res && res.hintEnglish && !isWrappingUp) {
        setHintData(res);
        setIsHintVisible(true);
        if (!hintsHistoryRef.current.includes(res.hintEnglish)) {
          hintsHistoryRef.current.push(res.hintEnglish);
        }
      }
    } finally {
      isFetchingHintRef.current = false;
    }
  };

  useEffect(() => {
    if (
      isTimeUp &&
      !hasTriggeredFarewellRef.current &&
      (liveCall.status === 'speaking' || liveCall.status === 'listening')
    ) {
      hasTriggeredFarewellRef.current = true;
      console.log(`[call.tsx] ⏰ Session time reached (${targetDuration}s) -> dispatching farewell cue to Maya`);
      liveCall.sendTimeWrapupCue(0);

      farewellGraceTimerRef.current = setTimeout(() => {
        console.log('[call.tsx] ⏰ Farewell grace period (25s) elapsed -> auto-ending call');
        liveCall.endCall();
      }, 25000);
    }
  }, [isTimeUp, liveCall.status]);

  useEffect(() => {
    return () => {
      if (farewellGraceTimerRef.current) clearTimeout(farewellGraceTimerRef.current);
    };
  }, []);

  const isCallReconnecting = liveCall.status === 'reconnecting' || connection.isReconnecting;
  const isCallConnectionLost = (connection.isLost || !connection.isOnline) && liveCall.status !== 'ended';
  const isSlowNetwork = liveCall.isSlowResponse || connection.isWeak;
  const isNaturalTimeRunningOut = (remainingSeconds <= 30 && liveCall.secondsElapsed > 0) || isFarewellPhase;

  const activeToastPreset: ToastPillPreset | null = isCallConnectionLost
    ? 'connection-lost'
    : isCallReconnecting
    ? 'reconnecting'
    : liveCall.isSlowResponse
    ? 'slow-connection'
    : isConcludingCall
    ? null
    : isNaturalTimeRunningOut
    ? 'session-ends'
    : connection.toastPreset;

  // Contextual Call Guide for Intro Call
  const [guideStepIndex, setGuideStepIndex] = useState<number | null>(null);

  const displayedStatusText = isCallConnectionLost
    ? 'Connection lost'
    : isCallReconnecting
    ? 'Reconnecting...'
    : liveCall.status === 'ended'
    ? 'Session ended'
    : (isConcludingCall || isFarewellPhase)
    ? 'Wrapping up...'
    : isIntro && guideStepIndex !== null
    ? 'Intro guide'
    : liveCall.isSlowResponse
    ? 'Maya is thinking...'
    : connection.isWeak
    ? 'Weak connection'
    : liveCall.status === 'speaking'
    ? 'Speaking..'
    : liveCall.status === 'connecting'
    ? 'Connecting...'
    : 'Listening...';

  // Animation values for dynamic speech-reactive ambient glows
  const purpleGlowAnim = useRef(new Animated.Value(0.38)).current;
  const purpleScaleAnim = useRef(new Animated.Value(1.0)).current;
  const blueAuraAnim = useRef(new Animated.Value(0)).current;
  const blueScaleAnim = useRef(new Animated.Value(1.0)).current;

  // ─── CINEMATIC HANDOFF: ConnectingView -> Active CallScreen ────────────────
  const [connectingVisible, setConnectingVisible] = useState(true);
  const connectingFadeAnim = useRef(new Animated.Value(1)).current;
  const connectingScaleAnim = useRef(new Animated.Value(1)).current;

  // CallScreen content starts subtly scaled down (0.965) & slightly lower so it blooms forward as ConnectingView dissolves
  const callContentOpacityAnim = useRef(new Animated.Value(0)).current;
  const callContentScaleAnim = useRef(new Animated.Value(0.965)).current;
  const callContentTranslateYAnim = useRef(new Animated.Value(10)).current;

  const hasTransitionedRef = useRef(false);
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // User speech & minimum 60s guard for Intro Call
  const hasUserSpoken = liveCall.turns.some((t) => t.role === 'user');
  const isIntroEndCallLocked = isIntro && (displayedElapsed < 60 || !hasUserSpoken);
  const [introLockedNotice, setIntroLockedNotice] = useState<string | null>(null);

  const hasShownGuideRef = useRef(false);

  useEffect(() => {
    if (isIntro && !connectingVisible && !hasShownGuideRef.current) {
      hasShownGuideRef.current = true;
      const timer = setTimeout(() => {
        setGuideStepIndex(0);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isIntro, connectingVisible]);

  // Dynamically showcase the live ambient glows on Step 0 (Blue Aura) & Step 1 (Purple Bloom)
  useEffect(() => {
    if (guideStepIndex === null) return;

    if (guideStepIndex === 0) {
      Animated.parallel([
        Animated.timing(blueAuraAnim, {
          toValue: 0.85,
          duration: 350,
          useNativeDriver: useNative,
        }),
        Animated.timing(purpleGlowAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else if (guideStepIndex === 1) {
      Animated.parallel([
        Animated.timing(purpleGlowAnim, {
          toValue: 0.95,
          duration: 350,
          useNativeDriver: useNative,
        }),
        Animated.timing(blueAuraAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(blueAuraAnim, {
          toValue: 0.05,
          duration: 300,
          useNativeDriver: useNative,
        }),
        Animated.timing(purpleGlowAnim, {
          toValue: 0.15,
          duration: 300,
          useNativeDriver: useNative,
        }),
      ]).start();
    }
  }, [guideStepIndex, blueAuraAnim, purpleGlowAnim, useNative]);

  // Orchestrate the smooth ConnectingView -> CallScreen transition
  useEffect(() => {
    const isNowConnected =
      liveCall.isConnected ||
      (liveCall.status !== 'connecting' && liveCall.status !== 'idle');

    if (isNowConnected && !hasTransitionedRef.current) {
      hasTransitionedRef.current = true;
      console.log('[call.tsx] 📞 Call connected! Showing green Connected state & choreographing reveal.');

      // 1. Play call connected chime immediately
      try {
        playCallConnectedSound();
      } catch {}

      // 2. After 580ms of showing the green "Connected!" celebration in ConnectingView:
      //    - Release Maya's greeting right as the curtain opens (so voice & subtitles start as CallScreen appears)
      //    - Simultaneously dissolve + zoom-out ConnectingView AND spring-bloom CallScreen in!
      const handoffTimer = setTimeout(() => {
        if (!isIntro) {
          liveCallRef.current.releaseGreeting?.();
        }

        Animated.parallel([
          // ConnectingView dissolves & subtly expands outward
          Animated.timing(connectingFadeAnim, {
            toValue: 0,
            duration: 420,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: useNative,
          }),
          Animated.timing(connectingScaleAnim, {
            toValue: 1.035,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: useNative,
          }),
          // Active CallScreen blooms forward into focus
          Animated.timing(callContentOpacityAnim, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: useNative,
          }),
          Animated.spring(callContentScaleAnim, {
            toValue: 1,
            tension: 75,
            friction: 9,
            useNativeDriver: useNative,
          }),
          Animated.spring(callContentTranslateYAnim, {
            toValue: 0,
            tension: 75,
            friction: 9,
            useNativeDriver: useNative,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            setConnectingVisible(false);
          }
        });
      }, 580);

      transitionTimersRef.current.push(handoffTimer);
    }
  }, [
    liveCall.isConnected,
    liveCall.status,
    isIntro,
    connectingFadeAnim,
    connectingScaleAnim,
    callContentOpacityAnim,
    callContentScaleAnim,
    callContentTranslateYAnim,
    useNative,
  ]);

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Animate glows reactively based on voice strength and call status
  // (Yields when Intro Guide is actively demonstrating glows on steps 0 & 1)
  useEffect(() => {
    if (guideStepIndex !== null) return;

    if (liveCall.status === 'speaking') {
      const isMayaProjecting = liveCall.modelVolume > 0.04;
      const targetBlueOpacity = 0.42 + Math.min(1, liveCall.modelVolume * 1.15) * 0.58;
      const targetBlueScale = 1.0 + Math.min(1, liveCall.modelVolume * 1.2) * 0.11;

      Animated.parallel([
        Animated.timing(purpleGlowAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: useNative,
        }),
        Animated.timing(purpleScaleAnim, {
          toValue: 0.94,
          duration: 280,
          useNativeDriver: useNative,
        }),
        Animated.timing(blueAuraAnim, {
          toValue: targetBlueOpacity,
          duration: isMayaProjecting ? 65 : 180,
          useNativeDriver: useNative,
        }),
        Animated.spring(blueScaleAnim, {
          toValue: targetBlueScale,
          friction: 5,
          tension: 120,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      const isUserSpeaking = liveCall.userVolume > 0.02;
      const boostedUserVol = Math.min(1, liveCall.userVolume * 1.3);
      const targetPurpleOpacity = 0.38 + boostedUserVol * 0.62;
      const targetPurpleScale = 1.0 + boostedUserVol * 0.34;

      Animated.parallel([
        Animated.timing(blueAuraAnim, {
          toValue: 0,
          duration: 320,
          useNativeDriver: useNative,
        }),
        Animated.timing(blueScaleAnim, {
          toValue: 1.0,
          duration: 320,
          useNativeDriver: useNative,
        }),
        Animated.timing(purpleGlowAnim, {
          toValue: targetPurpleOpacity,
          duration: isUserSpeaking ? 55 : 180,
          useNativeDriver: useNative,
        }),
        Animated.spring(purpleScaleAnim, {
          toValue: targetPurpleScale,
          friction: isUserSpeaking ? 4 : 7,
          tension: isUserSpeaking ? 140 : 80,
          useNativeDriver: useNative,
        }),
      ]).start();
    }
  }, [liveCall.status, liveCall.userVolume, liveCall.modelVolume, guideStepIndex, useNative]);

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [showForceEndPopup, setShowForceEndPopup] = useState(false);

  const handleHangup = () => {
    if (isIntro) {
      if (isIntroEndCallLocked) {
        const remaining = Math.max(0, 60 - displayedElapsed);
        const msg = !hasUserSpoken
          ? 'Say hello to Maya first before finishing!'
          : `Please chat with Maya for at least 1 minute (${remaining}s left)!`;
        setIntroLockedNotice(msg);
        setTimeout(() => setIntroLockedNotice(null), 2800);
        return;
      }
      if (!isConcludingCall) {
        setIsConcludingCall(true);
        liveCall.requestGracefulHangup();
      }
      return;
    }

    if (isConcludingCall || isFarewellPhase) {
      setShowForceEndPopup(true);
      return;
    }
    setIsConcludingCall(true);
    liveCall.requestGracefulHangup();
  };

  const handleBackToHome = () => {
    if (isConcludingCall || isFarewellPhase) {
      setShowForceEndPopup(true);
      return;
    }
    setIsConcludingCall(true);
    liveCall.requestGracefulHangup();
  };

  const handleForceEnd = () => {
    setShowForceEndPopup(false);
    if (farewellGraceTimerRef.current) {
      clearTimeout(farewellGraceTimerRef.current);
      farewellGraceTimerRef.current = null;
    }
    liveCall.endCall(true);
  };

  // When session completes, navigate directly to analyzing screen before showing completion scorecard
  useEffect(() => {
    if (liveCall.missionReport) {
      const activeSessionId = liveCall.sessionId || (liveCall.missionReport as any)?.id || '';
      setLatestSessionReport({
        ...liveCall.missionReport,
        id: activeSessionId,
        callParams: {
          ...params,
          sessionId: activeSessionId,
        },
        sessionTurns: liveCall.turns,
        activeHints: hintsHistoryRef.current,
      });
      if (isIntro) {
        console.log('[call.tsx] 🏁 Intro call concluded -> routing directly to /onboarding/building-plan');
        router.replace('/onboarding/building-plan' as any);
        return;
      }

      router.replace({
        pathname: '/call/analyzing' as any,
        params: {
          sessionId: activeSessionId,
          roadmapLevelId: liveCall.missionReport.roadmapLevelId || '',
          levelNumber: String(liveCall.missionReport.levelNumber || ''),
          levelTitle: liveCall.missionReport.levelTitle || '',
          durationSeconds: String(liveCall.missionReport.durationSeconds || ''),
          talkTimeSeconds: String(liveCall.missionReport.talkTimeSeconds || ''),
          overallScore: String(liveCall.missionReport.overallScore || ''),
          passed: String(liveCall.missionReport.passed),
          feedbackSinhala: liveCall.missionReport.feedbackSinhala || '',
          feedbackEnglish: liveCall.missionReport.feedbackEnglish || '',
          userSentencesCount: String(liveCall.missionReport.userSentencesCount || ''),
          xpEarned: String(liveCall.missionReport.xpEarned || ''),
          isGeneralChat: String(Boolean(liveCall.missionReport.isGeneralChat)),
        },
      });
    }
  }, [liveCall.missionReport]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.mainContentWrapper,
          {
            opacity: callContentOpacityAnim,
            transform: [
              { scale: callContentScaleAnim },
              { translateY: callContentTranslateYAnim },
            ],
          },
        ]}
      >
        <Pressable style={styles.fullScreenTouch}>
          <View style={[styles.container, isWebOrDesktop && styles.containerDesktop]}>
            {/* Ambient Edge Aura for Speaking State */}
            <AmbientGlow
              type="blue-aura"
              opacity={blueAuraAnim}
              scale={blueScaleAnim}
              volume={guideStepIndex === 0 ? 0.65 : liveCall.modelVolume}
              isActive={guideStepIndex === 0 || (liveCall.status === 'speaking' && liveCall.modelVolume > 0.04)}
            />

            {/* Top Bar Header */}
            {isWebOrDesktop ? (
              /* Desktop / Web Top Bar */
              <View style={styles.desktopTopBar}>
                {/* Left: Back to Home */}
                <Pressable
                  style={({ pressed }) => [
                    styles.backLink,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleBackToHome}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Home"
                >
                  <Text style={styles.backArrow}>‹</Text>
                  <Text style={styles.backText}>Back to Home</Text>
                </Pressable>

                {/* Right: Settings & End Session Pill */}
                <View style={styles.desktopRightActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsButton,
                      pressed && styles.buttonPressed,
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Call settings"
                  >
                    <Feather name="settings" size={20} color="#64748B" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.endSessionPillButton,
                      isIntroEndCallLocked && styles.endSessionPillLocked,
                      pressed && !isIntroEndCallLocked && styles.endSessionPressed,
                    ]}
                    onPress={handleHangup}
                    accessibilityRole="button"
                    accessibilityLabel={isIntroEndCallLocked ? 'End Session (Locked)' : 'End Session'}
                  >
                    <BeaconRing
                      color="#F43F5E"
                      radius={22}
                      active={guideStepIndex === 4}
                    />
                    {isIntroEndCallLocked ? (
                      <Feather name="lock" size={16} color="#94A3B8" />
                    ) : (
                      <EndCallIcon size={20} color="#ffffff" />
                    )}
                    <Text style={[styles.endSessionText, isIntroEndCallLocked && styles.endSessionTextLocked]}>
                      {isIntroEndCallLocked ? 'Locked (1m)' : 'End Session'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Mobile Phone Top Bar */
              <View style={styles.mobileTopBar}>
                <Pressable
                  style={({ pressed }) => [
                    styles.settingsButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Call settings"
                >
                  <Feather name="settings" size={20} color="#64748B" />
                </Pressable>

                <View style={styles.mobileHeaderInfo}>
                  <View style={styles.avatarWrapperMobile}>
                    <Image
                      source={require('@/assets/images/maya-avatar.png')}
                      style={styles.avatarImage}
                      resizeMode="cover"
                      accessibilityLabel="Maya"
                    />
                  </View>

                  <View style={styles.headerTexts}>
                    <Text style={styles.mayaNameMobile}>Maya</Text>
                    <View style={styles.timerRow}>
                      <View
                        style={[
                          styles.statusDot,
                          isCallConnectionLost
                            ? styles.statusDotRed
                            : isCallReconnecting || isSlowNetwork
                            ? styles.statusDotOrange
                            : styles.statusDotGreen,
                        ]}
                      />
                      <Text style={styles.timerText}>
                        {formatTime(displayedElapsed)}{' '}
                        <Text style={styles.timerMax}>/ {formatTime(targetDuration)}</Text>
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stateLabel,
                        isCallConnectionLost
                          ? styles.stateLabelLost
                          : isCallReconnecting || isSlowNetwork
                          ? styles.stateLabelWarning
                          : liveCall.status === 'speaking'
                          ? styles.stateLabelSpeaking
                          : styles.stateLabelListening,
                      ]}
                    >
                      {displayedStatusText}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.mobileHangupButton,
                    isIntroEndCallLocked && styles.hangupButtonLocked,
                    pressed && !isIntroEndCallLocked && styles.hangupButtonPressed,
                  ]}
                  onPress={handleHangup}
                  accessibilityRole="button"
                  accessibilityLabel={isIntroEndCallLocked ? 'End call (Locked)' : 'End call'}
                >
                  <BeaconRing
                    color="#F43F5E"
                    radius={27}
                    active={guideStepIndex === 4}
                  />
                  {isIntroEndCallLocked ? (
                    <Feather name="lock" size={24} color="#94A3B8" />
                  ) : (
                    <EndCallIcon size={28} color="#ffffff" />
                  )}
                </Pressable>
              </View>
            )}

            {/* Center Content Section */}
            <View style={[styles.centerContent, isWebOrDesktop && styles.centerContentDesktop]}>
              {/* On Desktop: Centered Avatar & Maya Status */}
              {isWebOrDesktop && (
                <View style={styles.desktopAvatarCard}>
                  <View style={styles.avatarWrapperDesktop}>
                    <Image
                      source={require('@/assets/images/maya-avatar.png')}
                      style={styles.avatarImage}
                      resizeMode="cover"
                      accessibilityLabel="Maya"
                    />
                  </View>

                  <View style={styles.desktopInfoTexts}>
                    <Text style={styles.mayaNameDesktop}>Maya</Text>
                    <View style={styles.timerRow}>
                      <View
                        style={[
                          styles.statusDot,
                          isCallConnectionLost
                            ? styles.statusDotRed
                            : isCallReconnecting || isSlowNetwork
                            ? styles.statusDotOrange
                            : styles.statusDotGreen,
                        ]}
                      />
                      <Text style={styles.timerTextDesktop}>
                        {formatTime(displayedElapsed)}{' '}
                        <Text style={styles.timerMax}>/ {formatTime(targetDuration)}</Text>
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stateLabelDesktop,
                        isCallConnectionLost
                          ? styles.stateLabelLost
                          : isCallReconnecting || isSlowNetwork
                          ? styles.stateLabelWarning
                          : liveCall.status === 'speaking'
                          ? styles.stateLabelSpeaking
                          : styles.stateLabelListening,
                      ]}
                    >
                      {displayedStatusText}
                    </Text>
                  </View>
                </View>
              )}

              {/* Session Ending & Network Connection Toast Pill */}
              <View style={styles.noticeWrapper}>
                {introLockedNotice ? (
                  <ToastPill
                    variant="warning"
                    text={introLockedNotice}
                    visible={true}
                  />
                ) : activeToastPreset ? (
                  <ToastPill
                    preset={activeToastPreset}
                    secondsRemaining={activeToastPreset === 'session-ends' && remainingSeconds > 0 ? remainingSeconds : undefined}
                    text={activeToastPreset === 'session-ends' && remainingSeconds === 0 ? 'Wrapping up session...' : undefined}
                    visible={true}
                  />
                ) : null}
              </View>

              {/* Evaluation Result Banner */}
              {liveCall.evaluationResult && (
                <View style={[
                  styles.evalCardContainer,
                  liveCall.evaluationResult.isPassed ? styles.evalCardPassed : styles.evalCardFailed,
                ]}>
                  <Feather
                    name={liveCall.evaluationResult.isPassed ? 'check-circle' : 'refresh-cw'}
                    size={20}
                    color={liveCall.evaluationResult.isPassed ? '#059669' : '#D97706'}
                  />
                  <View style={styles.evalTextCol}>
                    <Text style={[
                      styles.evalTitle,
                      liveCall.evaluationResult.isPassed ? styles.evalTitlePassed : styles.evalTitleFailed,
                    ]}>
                      {liveCall.evaluationResult.isPassed
                        ? `Level Mastered! (${liveCall.evaluationResult.scorePercent}%)`
                        : `Needs Practice (${liveCall.evaluationResult.scorePercent}%)`}
                    </Text>
                    <Text style={styles.evalSubtitle}>
                      {liveCall.evaluationResult.feedbackSinhala || liveCall.evaluationResult.feedbackEnglish || 'Great speaking session with Maya!'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Conversation Display with Multi-Turn History */}
              <ConversationDisplay
                previousText={liveCall.previousSubtitles}
                currentText={
                  isIntro && guideStepIndex !== null && !liveCall.subtitles
                    ? "Welcome to Maya! Let's practice speaking English together."
                    : liveCall.subtitles
                }
                isSpeaking={guideStepIndex === 0 || liveCall.status === 'speaking'}
                isWebOrDesktop={isWebOrDesktop}
                translationText={
                  isIntro && guideStepIndex !== null && !translationText
                    ? "මායා වෙත සාදරයෙන් පිළිගනිමු! අපි එකට ඉංග්‍රීසි කතා කිරීමට පුරුදු වෙමු."
                    : translationText
                }
                isTranslationVisible={isTranslationVisible}
                isTranslating={isTranslating}
                onToggleTranslation={handleToggleTranslation}
                isTranslationHighlighted={guideStepIndex === 2}
              />

              {/* Hint Suggestion Card */}
              {isHintVisible && !!hintData && (
                <View style={styles.hintCardWrapper}>
                  <HintSuggestionCard
                    hintEnglish={hintData.hintEnglish}
                    hintSinhala={hintData.hintSinhala}
                    onDismiss={() => setIsHintVisible(false)}
                    isWebOrDesktop={isWebOrDesktop}
                  />
                </View>
              )}
            </View>

            {/* Floating Hint Button in Bottom Right Corner */}
            {!isHintVisible && !isWrappingUp && (
              <View style={[styles.floatingHintContainer, { pointerEvents: 'box-none' }]}>
                <HintFloatingButton
                  onPress={handleToggleHint}
                  isActive={isHintVisible}
                  disabled={liveCall.status === 'connecting' || liveCall.status === 'idle'}
                  isHighlighted={guideStepIndex === 3}
                />
              </View>
            )}

            {/* Bottom Purple Ambient Glow for Listening State */}
            <AmbientGlow
              type="purple-bottom"
              opacity={purpleGlowAnim}
              scale={purpleScaleAnim}
              volume={guideStepIndex === 1 ? 0.75 : liveCall.userVolume}
              isActive={guideStepIndex === 1 || (liveCall.status === 'listening' && liveCall.userVolume > 0.02)}
            />
          </View>
        </Pressable>
      </Animated.View>

      {/* Smooth connecting overlay with opacity + subtle zoom-out handoff */}
      {connectingVisible && (
        <Animated.View
          renderToHardwareTextureAndroid={true}
          shouldRasterizeIOS={true}
          style={[
            styles.connectingOverlay,
            {
              opacity: connectingFadeAnim,
              transform: [{ scale: connectingScaleAnim }],
              pointerEvents: liveCall.status === 'connecting' ? 'auto' : 'none',
            },
          ]}
        >
          <ConnectingView
            onCancel={handleHangup}
            isConnected={liveCall.isConnected || (liveCall.status !== 'connecting' && liveCall.status !== 'idle')}
          />
        </Animated.View>
      )}

      {/* Grammar Feedback Modal */}
      <GrammarFeedbackModal
        visible={liveCall.feedbackVisible}
        onClose={liveCall.closeFeedbackModal}
        feedback={liveCall.feedbackData || undefined}
      />

      {/* Microphone Permission Modal */}
      <MicrophonePermissionPopup
        visible={liveCall.isPermissionModalVisible}
        onClose={() => {
          liveCall.closePermissionModal();
          handleHangup();
        }}
        onAllow={liveCall.requestMicrophoneAndStart}
        errorType={liveCall.permissionErrorType}
      />

      {/* Force End Call Confirmation Popup */}
      <CommonPopup
        visible={showForceEndPopup}
        onClose={() => setShowForceEndPopup(false)}
        preset="custom"
        title="Force End Call?"
        titleHighlight="Force End"
        subtitle="This will force end the call immediately without waiting for Maya to finish concluding."
        imageSource={require('@/assets/images/mayaclock.png')}
        primaryButtonText="End Call"
        primaryButtonVariant="danger"
        primaryButtonIcon={<EndCallIcon size={18} color="#FFFFFF" />}
        showPrimaryArrow={false}
        onPrimaryPress={handleForceEnd}
        footerButtonText="Wait for Maya to finish"
        onFooterButtonPress={() => setShowForceEndPopup(false)}
        showCloseButton={true}
      />

      {/* Contextual Call Guide */}
      {isIntro && (
        <ContextualCallGuide
          visible={guideStepIndex !== null}
          currentStepIndex={guideStepIndex ?? 0}
          onStepChange={(idx) => setGuideStepIndex(idx)}
          onFinish={() => {
            setGuideStepIndex(null);
            setIsTranslationVisible(false);
            setTranslationText('');
            liveCall.releaseGreeting?.();
          }}
          isDesktop={isWebOrDesktop}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    position: 'relative',
  },
  mainContentWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ willChange: 'transform, opacity' } as any)
      : {}),
  },
  connectingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f6f8fd',
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({ willChange: 'transform, opacity' } as any)
      : {}),
  },
  fullScreenTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  containerDesktop: {
    maxWidth: '100%',
  },
  /* Desktop Top Bar */
  desktopTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 20,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 22,
    color: '#64748b',
    lineHeight: 22,
  },
  backText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14,
    color: '#64748b',
  },
  desktopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  endSessionPillButton: {
    backgroundColor: '#ef4444',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 8px rgba(239, 68, 68, 0.3)' } as any,
      default: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  endSessionPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.98 }],
  },
  endSessionIcon: {
    fontSize: 16,
    color: '#ffffff',
    transform: [{ rotate: '135deg' }],
  },
  endSessionText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 14,
  },
  endSessionPillLocked: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...Platform.select({
      web: { boxShadow: 'none' } as any,
      default: {
        shadowOpacity: 0,
        elevation: 0,
      },
    }),
  },
  endSessionTextLocked: {
    color: '#94A3B8',
  },
  /* Mobile Top Bar */
  mobileTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 20,
  },
  mobileHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginLeft: 16,
  },
  avatarWrapperMobile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0, 133, 219, 0.15)' } as any,
      default: {
        shadowColor: '#0085db',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  mobileHangupButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 10px rgba(239, 68, 68, 0.35)' } as any,
      default: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  hangupButtonLocked: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    ...Platform.select({
      web: { boxShadow: 'none' } as any,
      default: {
        shadowOpacity: 0,
        elevation: 0,
      },
    }),
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  headerTexts: {
    justifyContent: 'center',
  },
  mayaNameMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  /* Desktop Centered Avatar Card */
  desktopAvatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  avatarWrapperDesktop: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(0, 133, 219, 0.2)' } as any,
      default: {
        shadowColor: '#0085db',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  desktopInfoTexts: {
    justifyContent: 'center',
  },
  mayaNameDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  timerTextDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  stateLabelDesktop: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    marginTop: 3,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#22c55e',
  },
  statusDotRed: {
    backgroundColor: '#ef4444',
  },
  statusDotOrange: {
    backgroundColor: '#f59e0b',
  },
  timerText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  timerMax: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13,
    color: '#94a3b8',
    fontVariant: ['tabular-nums'],
  },
  stateLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    marginTop: 2,
  },
  stateLabelSpeaking: {
    color: '#0ea5e9',
  },
  stateLabelListening: {
    color: '#a855f7',
  },
  stateLabelWarning: {
    color: '#f59e0b',
  },
  stateLabelLost: {
    color: '#ef4444',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
    zIndex: 10,
  },
  centerContentDesktop: {
    maxWidth: 780,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 36,
  },
  noticeWrapper: {
    minHeight: 40,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  promptTextDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 28,
    lineHeight: 40,
    maxWidth: 720,
  },
  hangupButtonPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.95 }],
  },
  hangupIcon: {
    fontSize: 22,
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  /* Evaluation Result Banner */
  evalCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 640,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
  },
  evalCardPassed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  evalCardFailed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  evalTextCol: {
    flex: 1,
  },
  evalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    marginBottom: 2,
  },
  evalTitlePassed: {
    color: '#059669',
  },
  evalTitleFailed: {
    color: '#D97706',
  },
  evalSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 17,
  },
  hintCardWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    zIndex: 15,
  },
  floatingHintContainer: {
    position: 'absolute',
    bottom: Platform.select({ web: 38, default: 28 }),
    right: 20,
    zIndex: 35,
  },
});