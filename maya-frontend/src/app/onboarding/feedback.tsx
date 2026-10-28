import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  getLatestFeedbackItems,
  getLatestSessionReport,
  FeedbackItem,
} from '@/utils/session-report-store';
import { speakAsCallirrhoe, stopMayaVoiceFallback } from '@/utils/maya-voice-fallback';
import { playUnderstoodTapSound, playFinishReviewFanfare } from '@/services/sound/sound-service';
import Svg, { Path } from 'react-native-svg';
import { useUserStats } from '@/hooks/useUserStats';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { CommonPopup } from '@/components/ui/common-popup';

function CorrectCardStarIcon({ size = 19, color = '#00BCA5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 19 19" fill="none">
      <Path
        d="M9.16667 0C9.6875 5.9375 12.2917 8.54167 18.2292 9.0625C12.2917 9.58333 9.6875 12.1875 9.16667 18.2292C8.64583 12.1875 6.04167 9.58333 0 9.0625C6.04167 8.54167 8.64583 5.9375 9.16667 0Z"
        fill={color}
      />
    </Svg>
  );
}

const GLOW_PARTICLES = [
  { id: 1, left: '10%', top: '68%', size: 4, delay: '0s', duration: '2.5s' },
  { id: 2, left: '22%', top: '78%', size: 3, delay: '0.6s', duration: '2.8s' },
  { id: 3, left: '38%', top: '58%', size: 5, delay: '1.2s', duration: '2.3s' },
  { id: 4, left: '52%', top: '72%', size: 3.5, delay: '0.3s', duration: '2.7s' },
  { id: 5, left: '68%', top: '62%', size: 4.5, delay: '1.7s', duration: '2.4s' },
  { id: 6, left: '82%', top: '75%', size: 3, delay: '0.9s', duration: '2.9s' },
  { id: 7, left: '30%', top: '42%', size: 3, delay: '1.4s', duration: '2.2s' },
  { id: 8, left: '74%', top: '38%', size: 4, delay: '2.0s', duration: '2.6s' },
];

function GlowingParticle({ p }: { p: (typeof GLOW_PARTICLES)[0] }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delayMs = parseFloat(p.delay) * 1000;
    const durationMs = parseFloat(p.duration) * 1000;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: durationMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    }, delayMs);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, -6, -16, -24],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0.6, 1.2, 0.9, 0.3],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, 0.95, 0.75, 0],
  });

  return (
    <Animated.View
      style={[
        styles.glowParticle,
        {
          left: p.left as any,
          top: p.top as any,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          opacity,
          transform: [{ translateY }, { scale }],
          boxShadow: '0 0 6px #FFFFFF, 0 0 12px #93C5FD, 0 0 18px #38BDF8',
        },
      ]}
    />
  );
}

const PARTICLE_ANIMATION_CSS = `
@keyframes mayaParticleFloat {
  0% {
    transform: translateY(0px) scale(0.6);
    opacity: 0;
  }
  25% {
    opacity: 0.95;
    transform: translateY(-6px) scale(1.2);
  }
  75% {
    opacity: 0.75;
    transform: translateY(-16px) scale(0.9);
  }
  100% {
    transform: translateY(-24px) scale(0.3);
    opacity: 0;
  }
}

.maya-particle-1 { animation: mayaParticleFloat 2.5s ease-in-out 0s infinite !important; }
.maya-particle-2 { animation: mayaParticleFloat 2.8s ease-in-out 0.6s infinite !important; }
.maya-particle-3 { animation: mayaParticleFloat 2.3s ease-in-out 1.2s infinite !important; }
.maya-particle-4 { animation: mayaParticleFloat 2.7s ease-in-out 0.3s infinite !important; }
.maya-particle-5 { animation: mayaParticleFloat 2.4s ease-in-out 1.7s infinite !important; }
.maya-particle-6 { animation: mayaParticleFloat 2.9s ease-in-out 0.9s infinite !important; }
.maya-particle-7 { animation: mayaParticleFloat 2.2s ease-in-out 1.4s infinite !important; }
.maya-particle-8 { animation: mayaParticleFloat 2.6s ease-in-out 2.0s infinite !important; }

@keyframes mayaButtonGlowPulse {
  0%, 100% {
    box-shadow: 0 8px 24px rgba(0, 122, 255, 0.42), 0 0 16px rgba(56, 189, 248, 0.35);
  }
  50% {
    box-shadow: 0 10px 32px rgba(0, 122, 255, 0.65), 0 0 24px rgba(56, 189, 248, 0.6);
  }
}

@keyframes mayaShimmerSweep {
  0% {
    transform: translateX(-150%) skewX(-20deg);
    opacity: 0;
  }
  15% {
    opacity: 0.55;
  }
  40% {
    transform: translateX(250%) skewX(-20deg);
    opacity: 0;
  }
  100% {
    transform: translateX(250%) skewX(-20deg);
    opacity: 0;
  }
}
`;

export default function SessionFeedbackScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Retrieve feedback items loaded during analyzing screen (strictly from AI)
  const [items, setItems] = useState<FeedbackItem[]>(() => {
    const stored = getLatestFeedbackItems();
    if (stored && stored.length > 0) return stored;
    return [];
  });

  const userStats = useUserStats();
  const onboardingUser = OnboardingStore.getState().user;
  const currentPlanTier = (userStats.planTier || onboardingUser?.planTier || 'starter').toLowerCase();
  const isStarter = currentPlanTier === 'starter';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // If user is on Starter plan, limit them to 1 review suggestion;
  // Basic, Pro, and Premium plans unlock all review suggestions.
  const rawTotalCount = items.length;
  const totalCount = isStarter && rawTotalCount > 1 ? 1 : Math.max(rawTotalCount, 1);
  const currentItem: FeedbackItem = items[currentIndex] || items[0];
  const isLastCard = currentIndex >= totalCount - 1;
  const hasHiddenSuggestions = isStarter && rawTotalCount > 1;

  useEffect(() => {
    if (!items || items.length === 0) {
      router.replace({
        pathname: '/onboarding/complete' as any,
        params: params as any,
      });
    }
  }, [items]);

  // Active audio playing state: 'intro' | 'youSaid' | 'betterWay' | 'explanation' | null
  const [currentSpeakingCard, setCurrentSpeakingCard] = useState<
    'intro' | 'youSaid' | 'betterWay' | 'explanation' | null
  >(null);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const sequenceIdRef = useRef<number>(0);

  // Stop active playback on unmount, slide change, or manual stop
  const stopActiveAudio = () => {
    sequenceIdRef.current++;
    if (activeAudioElementRef.current) {
      try {
        activeAudioElementRef.current.pause();
        activeAudioElementRef.current.currentTime = 0;
      } catch {}
      activeAudioElementRef.current = null;
    }
    stopMayaVoiceFallback();
    setCurrentSpeakingCard(null);
  };

  useEffect(() => {
    return () => {
      stopActiveAudio();
    };
  }, []);

  // Preload user turn audio elements in the background for instant 0ms playback
  useEffect(() => {
    if (items && items.length > 0 && typeof window !== 'undefined') {
      items.forEach((item) => {
        if (item.userAudioUrl && (item.userAudioUrl.startsWith('http://') || item.userAudioUrl.startsWith('https://'))) {
          try {
            const pre = new Audio();
            pre.preload = 'auto';
            pre.src = item.userAudioUrl.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
          } catch {}
        }
      });
    }
  }, [items]);

  // Helper promise to speak text using Callirrhoe voice with safety timeout
  const speakAsCallirrhoePromise = (text: string, rate: number = 1.0): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      };

      const wordCount = (text || '').split(/\s+/).filter(Boolean).length;
      const maxWaitMs = Math.max(6000, wordCount * 800);
      const timeoutId = setTimeout(safeResolve, maxWaitMs);

      const ok = speakAsCallirrhoe(text, {
        rate,
        onEnd: safeResolve,
        onError: safeResolve,
      });
      if (!ok) {
        safeResolve();
      }
    });
  };

  // Helper promise to play user's recording or speech progressively with zero download freeze
  const playUserVoiceAudioPromise = (item: FeedbackItem): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      };

      const wordCount = (item.youSaid || '').split(/\s+/).filter(Boolean).length;
      const maxWaitMs = Math.max(8000, wordCount * 1000);
      const timeoutId = setTimeout(safeResolve, maxWaitMs);

      const rawUrl = item.userAudioUrl || '';
      const userAudioUrl = rawUrl.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');

      // Only load remote persistent HTTPS audio (Supabase storage), ignore expired in-memory blob: URLs
      const isPersistentRemoteAudio = userAudioUrl &&
        typeof window !== 'undefined' &&
        (userAudioUrl.startsWith('http://') || userAudioUrl.startsWith('https://'));

      if (isPersistentRemoteAudio) {
        try {
          const audio = new Audio(userAudioUrl);
          audio.preload = 'auto';
          activeAudioElementRef.current = audio;

          audio.onended = () => {
            activeAudioElementRef.current = null;
            safeResolve();
          };

          audio.onerror = (e) => {
            console.warn('[SessionFeedback] Progressive audio stream error:', e);
            activeAudioElementRef.current = null;
            safeResolve();
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('[SessionFeedback] audio.play() rejected:', err);
              activeAudioElementRef.current = null;
              safeResolve();
            });
          }
        } catch (err) {
          console.warn('[SessionFeedback] Audio playback error:', err);
          activeAudioElementRef.current = null;
          safeResolve();
        }
        return;
      }

      console.warn('[SessionFeedback] No valid Supabase audio URL available for user audio turn');
      safeResolve();
    });
  };

  // Automated sequence:
  // 1. Tell intro: "Let’s make this more correct. Here’s a sentence from your conversation and how you can improve it."
  // 2. Auto play user audio ("You said")
  // 3. Auto play correct audio ("A better way to say it")
  // 4. Auto play explanation ("Why this is correct")
  const startCardAudioSequence = async (item: FeedbackItem) => {
    // 1. Stop any prior playback cleanly
    stopActiveAudio();

    const seqId = ++sequenceIdRef.current;
    const isCancelled = () => seqId !== sequenceIdRef.current;

    // Step 1: Voice announces header intro:
    // "Let’s make this more correct. Here’s a sentence from your conversation and how you can improve it."
    const cleanTitle = (item.title || '').trim();
    const cleanSubtitle = (item.subtitle || '').trim();
    const introText = cleanTitle.endsWith('.')
      ? `${cleanTitle} ${cleanSubtitle}`
      : `${cleanTitle}. ${cleanSubtitle}`;

    setCurrentSpeakingCard('intro');
    await speakAsCallirrhoePromise(introText, 1.0);
    if (isCancelled()) return;

    await new Promise((r) => setTimeout(r, 200));
    if (isCancelled()) return;

    // Step 2: Auto play user audio with spoken lead-in ("You said")
    setCurrentSpeakingCard('youSaid');
    await speakAsCallirrhoePromise('You said', 1.0);
    if (isCancelled()) return;

    await new Promise((r) => setTimeout(r, 150));
    if (isCancelled()) return;

    await playUserVoiceAudioPromise(item);
    if (isCancelled()) return;

    await new Promise((r) => setTimeout(r, 200));
    if (isCancelled()) return;

    // Step 3: Auto play correct audio with matching spoken lead-in
    setCurrentSpeakingCard('betterWay');
    const isBetterWayCard = item.type === 'grammar' || item.type === 'pronunciation';
    const leadInText = isBetterWayCard
      ? 'A better way to say this is:'
      : 'A more natural way to say this is:';
    const betterWayNarration = `${leadInText} ${item.betterWay}`;
    await speakAsCallirrhoePromise(betterWayNarration, 1.0);
    if (isCancelled()) return;

    await new Promise((r) => setTimeout(r, 200));
    if (isCancelled()) return;

    // Step 4: Auto play explanation ("Why this is correct")
    setCurrentSpeakingCard('explanation');
    await speakAsCallirrhoePromise(item.whyExplanation, 1.0);
    if (isCancelled()) return;

    setCurrentSpeakingCard(null);
  };

  // Manual replay toggles for each section
  const handleToggleIntroAudio = () => {
    if (currentSpeakingCard === 'intro') {
      stopActiveAudio();
      return;
    }
    stopActiveAudio();
    const seqId = ++sequenceIdRef.current;
    setCurrentSpeakingCard('intro');
    const cleanTitle = (currentItem.title || '').trim();
    const cleanSubtitle = (currentItem.subtitle || '').trim();
    const introText = cleanTitle.endsWith('.')
      ? `${cleanTitle} ${cleanSubtitle}`
      : `${cleanTitle}. ${cleanSubtitle}`;

    speakAsCallirrhoePromise(introText, 1.0).finally(() => {
      if (sequenceIdRef.current === seqId) {
        setCurrentSpeakingCard(null);
      }
    });
  };

  const handleToggleUserAudio = () => {
    if (currentSpeakingCard === 'youSaid') {
      stopActiveAudio();
      return;
    }
    stopActiveAudio();
    const seqId = ++sequenceIdRef.current;
    setCurrentSpeakingCard('youSaid');
    // Instantly play user audio without waiting for TTS lead-in on manual tap
    playUserVoiceAudioPromise(currentItem).finally(() => {
      if (sequenceIdRef.current === seqId) {
        setCurrentSpeakingCard(null);
      }
    });
  };

  const handleToggleBetterWayAudio = () => {
    if (currentSpeakingCard === 'betterWay') {
      stopActiveAudio();
      return;
    }
    stopActiveAudio();
    const seqId = ++sequenceIdRef.current;
    setCurrentSpeakingCard('betterWay');
    const isBetterWayCard = currentItem.type === 'grammar' || currentItem.type === 'pronunciation';
    const leadInText = isBetterWayCard
      ? 'A better way to say this is:'
      : 'A more natural way to say this is:';
    const betterWayNarration = `${leadInText} ${currentItem.betterWay}`;
    speakAsCallirrhoePromise(betterWayNarration, 1.0).finally(() => {
      if (sequenceIdRef.current === seqId) {
        setCurrentSpeakingCard(null);
      }
    });
  };

  const handleToggleExplanationAudio = () => {
    if (currentSpeakingCard === 'explanation') {
      stopActiveAudio();
      return;
    }
    stopActiveAudio();
    const seqId = ++sequenceIdRef.current;
    setCurrentSpeakingCard('explanation');
    speakAsCallirrhoePromise(currentItem.whyExplanation, 1.0).finally(() => {
      if (sequenceIdRef.current === seqId) {
        setCurrentSpeakingCard(null);
      }
    });
  };

  // Automated voice narration sequence on card mount
  useEffect(() => {
    stopActiveAudio();
    // Allow 120ms for screen transition and previous audio session to cleanly release
    const timer = setTimeout(() => {
      startCardAudioSequence(currentItem);
    }, 120);

    return () => {
      clearTimeout(timer);
      stopActiveAudio();
    };
  }, [currentIndex]);

  const handleNext = () => {
    stopActiveAudio();
    if (isLastCard) {
      playFinishReviewFanfare();
      // Brief delay so celebratory chime resonates before navigating
      setTimeout(() => {
        router.replace({
          pathname: '/call/complete' as any,
          params: params as any,
        });
      }, 260);
    } else {
      playUnderstoodTapSound();
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    stopActiveAudio();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      router.back();
    }
  };

  const handleSkipAll = () => {
    stopActiveAudio();
    playUnderstoodTapSound();
    router.replace({
      pathname: '/call/complete' as any,
      params: params as any,
    });
  };

  function cleanWord(w: string): string {
    return (w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function findHighlightDiff(
    original?: string,
    updated?: string,
  ): { originalHighlight?: string; updatedHighlight?: string } {
    if (!original || !updated) return {};
    const origWords = original.trim().split(/\s+/).filter(Boolean);
    const updWords = updated.trim().split(/\s+/).filter(Boolean);

    let prefixLen = 0;
    while (
      prefixLen < origWords.length &&
      prefixLen < updWords.length &&
      cleanWord(origWords[prefixLen]) === cleanWord(updWords[prefixLen])
    ) {
      prefixLen++;
    }

    let origSuffix = origWords.length - 1;
    let updSuffix = updWords.length - 1;
    while (
      origSuffix >= prefixLen &&
      updSuffix >= prefixLen &&
      cleanWord(origWords[origSuffix]) === cleanWord(updWords[updSuffix])
    ) {
      origSuffix--;
      updSuffix--;
    }

    const origDiffWords = origWords.slice(prefixLen, origSuffix + 1);
    const updDiffWords = updWords.slice(prefixLen, updSuffix + 1);

    let origDiff = origDiffWords.join(' ');
    let updDiff = updDiffWords.join(' ');

    if (!origDiff && updDiff && prefixLen < origWords.length) {
      origDiff = origWords[prefixLen];
    } else if (!updDiff && origDiff && prefixLen < updWords.length) {
      updDiff = updWords[prefixLen];
    }

    return {
      originalHighlight: origDiff ? origDiff.trim() : undefined,
      updatedHighlight: updDiff ? updDiff.trim() : undefined,
    };
  }

  // Render highlighted sentence parts
  const renderYouSaidText = () => {
    if (currentItem.type === 'pronunciation') {
      return (
        <View>
          <Text style={styles.pronunciationTargetWord}>
            “<Text style={styles.targetWordRed}>{currentItem.youSaid}</Text>”
          </Text>
          {currentItem.youSaidDetail ? (
            <Text style={styles.phoneticDetailText}>{currentItem.youSaidDetail}</Text>
          ) : null}
        </View>
      );
    }

    const phrase = currentItem.youSaid || '';
    let highlight = currentItem.youSaidHighlight?.trim();

    if (!highlight || !phrase.toLowerCase().includes(highlight.toLowerCase())) {
      const fallback = findHighlightDiff(phrase, currentItem.betterWay);
      if (fallback.originalHighlight && phrase.toLowerCase().includes(fallback.originalHighlight.toLowerCase())) {
        highlight = fallback.originalHighlight;
      }
    }

    if (highlight) {
      const lowerPhrase = phrase.toLowerCase();
      const lowerHighlight = highlight.toLowerCase();
      const idx = lowerPhrase.indexOf(lowerHighlight);
      if (idx !== -1) {
        const before = phrase.slice(0, idx);
        const match = phrase.slice(idx, idx + highlight.length);
        const after = phrase.slice(idx + highlight.length);
        return (
          <Text style={styles.cardSentenceText}>
            {before}
            <Text style={styles.pinkHighlightTag}>{match}</Text>
            {after}
          </Text>
        );
      }
    }

    return <Text style={styles.cardSentenceText}>{phrase}</Text>;
  };

  const renderBetterWayText = () => {
    if (currentItem.type === 'pronunciation') {
      return (
        <View>
          <Text style={styles.pronunciationTargetWord}>
            “<Text style={styles.targetWordGreen}>{currentItem.betterWay}</Text>”
          </Text>
          {currentItem.ipa ? (
            <Text style={styles.ipaText}>{currentItem.ipa}</Text>
          ) : null}
        </View>
      );
    }

    const phrase = currentItem.betterWay || '';
    let highlight = currentItem.betterWayHighlight?.trim();

    if (!highlight || !phrase.toLowerCase().includes(highlight.toLowerCase())) {
      const fallback = findHighlightDiff(currentItem.youSaid, phrase);
      if (fallback.updatedHighlight && phrase.toLowerCase().includes(fallback.updatedHighlight.toLowerCase())) {
        highlight = fallback.updatedHighlight;
      }
    }

    if (highlight) {
      const lowerPhrase = phrase.toLowerCase();
      const lowerHighlight = highlight.toLowerCase();
      const idx = lowerPhrase.indexOf(lowerHighlight);
      if (idx !== -1) {
        const before = phrase.slice(0, idx);
        const match = phrase.slice(idx, idx + highlight.length);
        const after = phrase.slice(idx + highlight.length);
        return (
          <Text style={styles.cardSentenceText}>
            {before}
            <Text style={styles.greenHighlightTag}>{match}</Text>
            {after}
          </Text>
        );
      }
    }

    return <Text style={styles.cardSentenceText}>{phrase}</Text>;
  };

  // Badge configurations based on card category
  const badgeConfig = useMemo(() => {
    if (currentItem.type === 'grammar') {
      return {
        bg: '#EBF5FF',
        text: '#0284C7',
        iconName: 'radio-button-on' as const,
        iconFamily: 'ionicons' as const,
        whyTitle: 'Why this is correct',
        betterTitle: 'A better way to say it',
      };
    }
    if (currentItem.type === 'pronunciation') {
      return {
        bg: '#E0F2FE',
        text: '#0284C7',
        iconName: 'mic' as const,
        iconFamily: 'ionicons' as const,
        whyTitle: 'Pronunciation tip',
        betterTitle: 'A better way to say it',
      };
    }
    return {
      bg: '#EFF6FF',
      text: '#2563EB',
      iconName: 'chatbubble' as const,
      iconFamily: 'ionicons' as const,
      whyTitle: 'Why this sounds more fluent',
      betterTitle: 'A more natural way to say it',
    };
  }, [currentItem.type]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isPhone && styles.containerPhone, isWebOrDesktop && styles.containerDesktop]}>
        
        {/* Top Header: Back Button + 5-Segment Progress Bar */}
        <View style={[styles.headerRow, isPhone && styles.headerRowPhone]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color="#0F172A" />
          </Pressable>

          {/* Dynamic Segmented Progress Bar based on actual item count */}
          <View style={styles.progressSegmentsRow}>
            {Array.from({ length: totalCount }).map((_, idx) => {
              const isFilled = idx <= currentIndex;
              return (
                <View
                  key={idx}
                  style={[
                    styles.progressSegmentPill,
                    isFilled ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  ]}
                />
              );
            })}
          </View>

          {/* Counter Tag */}
          <Text style={styles.counterText}>
            {currentIndex + 1} / {totalCount}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isPhone && styles.scrollContentPhone]}
          showsVerticalScrollIndicator={false}
        >
          {/* Category Badge Pill & Speaking Indicator */}
          <View style={[styles.badgeRow, isPhone && styles.badgeRowPhone]}>
            <View style={[styles.categoryBadge, isPhone && styles.categoryBadgePhone, { backgroundColor: badgeConfig.bg }]}>
              <Ionicons name={badgeConfig.iconName as any} size={isPhone ? 14 : 16} color={badgeConfig.text} />
              <Text style={[styles.categoryBadgeText, isPhone && styles.categoryBadgeTextPhone, { color: badgeConfig.text }]}>
                {currentItem.badge}
              </Text>
            </View>
            {currentSpeakingCard === 'intro' ? (
              <View/>
            ) : (
              <Pressable
                onPress={handleToggleIntroAudio}
                hitSlop={8}
                style={styles.introReplayButton}
              >
                <Ionicons name="volume-medium-outline" size={17} color="#64748B" />
              </Pressable>
            )}
          </View>

          {/* Title Headline */}
          <Pressable onPress={handleToggleIntroAudio}>
            <Text style={[styles.mainTitle, isPhone ? styles.mainTitlePhone : (isWebOrDesktop && styles.mainTitleDesktop)]}>
              {currentItem.title}
            </Text>
          </Pressable>

          {/* Context Subtitle */}
          <Pressable onPress={handleToggleIntroAudio}>
            <Text style={[styles.subTitle, isPhone ? styles.subTitlePhone : (isWebOrDesktop && styles.subTitleDesktop)]}>
              {currentItem.subtitle}
            </Text>
          </Pressable>

          {/* Card 1: You Said (Warm Peach / Pink Card) */}
          <View style={[styles.cardPeach, isPhone && styles.cardCompact]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardLabelRow}>
                <Ionicons name="person" size={isPhone ? 15 : 17} color="#0284C7" />
                <Text style={[styles.cardLabelPeach, isPhone && styles.cardLabelPhone]}>You said</Text>
              </View>

              {/* Speaker Playback Button */}
              <Pressable
                onPress={handleToggleUserAudio}
                style={({ pressed }) => [
                  styles.speakerButton,
                  isPhone && styles.speakerButtonPhone,
                  currentSpeakingCard === 'youSaid' && styles.speakerButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="volume-high"
                  size={isPhone ? 17 : 20}
                  color={currentSpeakingCard === 'youSaid' ? '#ffffff' : '#0284C7'}
                />
              </Pressable>
            </View>

            <View style={styles.cardBodyTextWrapper}>
              {renderYouSaidText()}
            </View>
          </View>

          {/* Connector Down Arrow */}
          <View style={[styles.connectorRow, isPhone && styles.connectorRowPhone]}>
            <View style={[styles.connectorCircle, isPhone && styles.connectorCirclePhone]}>
              <Feather name="arrow-down" size={isPhone ? 15 : 19} color="#0284C7" />
            </View>
          </View>

          {/* Card 2: A Better / More Natural Way (Mint Green Card) */}
          <View style={[styles.cardGreen, isPhone && styles.cardCompact]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardLabelRow}>
                <CorrectCardStarIcon size={isPhone ? 16 : 19} color="#00BCA5" />
                <Text style={[styles.cardLabelGreen, isPhone && styles.cardLabelPhone]}>{badgeConfig.betterTitle}</Text>
              </View>

              {/* Speaker Playback Button for Maya's Voice */}
              <Pressable
                onPress={handleToggleBetterWayAudio}
                style={({ pressed }) => [
                  styles.speakerButton,
                  isPhone && styles.speakerButtonPhone,
                  currentSpeakingCard === 'betterWay' && styles.speakerButtonActiveGreen,
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="volume-high"
                  size={isPhone ? 17 : 20}
                  color={currentSpeakingCard === 'betterWay' ? '#ffffff' : '#059669'}
                />
              </Pressable>
            </View>

            <View style={styles.cardBodyTextWrapper}>
              {renderBetterWayText()}
            </View>
          </View>

          {/* Card 3: Why Explanation (Ice Blue Card) */}
          <View style={[styles.cardBlue, isPhone && styles.cardCompact, isPhone && { marginTop: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardLabelRow}>
                <Ionicons name="bulb-outline" size={isPhone ? 16 : 19} color="#0284C7" />
                <Text style={[styles.cardLabelBlue, isPhone && styles.cardLabelPhone]}>{badgeConfig.whyTitle}</Text>
              </View>

              {/* Speaker Playback Button for Explanation */}
              <Pressable
                onPress={handleToggleExplanationAudio}
                style={({ pressed }) => [
                  styles.speakerButton,
                  isPhone && styles.speakerButtonPhone,
                  currentSpeakingCard === 'explanation' && styles.speakerButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="volume-high"
                  size={isPhone ? 17 : 20}
                  color={currentSpeakingCard === 'explanation' ? '#ffffff' : '#0284C7'}
                />
              </Pressable>
            </View>

            <View style={styles.cardBodyTextWrapper}>
              <Text style={[styles.whyExplanationText, isPhone && styles.whyExplanationTextPhone]}>
                {currentItem.whyExplanation}
              </Text>
            </View>
          </View>

          {/* Starter Plan: Upgrade Prompt Banner encouraging users to unlock all review suggestions */}
          {hasHiddenSuggestions && (
            <Pressable
              onPress={() => setShowUpgradeModal(true)}
              style={({ pressed }) => [
                styles.upgradePromptCard,
                isPhone && styles.upgradePromptCardPhone,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Upgrade your plan to unlock all review suggestions"
            >
              <View style={styles.upgradePromptIconCircle}>
                <Ionicons name="lock-closed" size={20} color="#D97706" />
              </View>
              <View style={styles.upgradePromptTextCol}>
                <View style={styles.upgradePromptHeaderRow}>
                  <Text style={styles.upgradePromptTitle}>
                    +{rawTotalCount - 1} More {rawTotalCount - 1 === 1 ? 'Suggestion' : 'Suggestions'} Locked
                  </Text>
                  <View style={styles.upgradeProBadge}>
                    <Text style={styles.upgradeProBadgeText}>PRO</Text>
                  </View>
                </View>
                <Text style={styles.upgradePromptDesc}>
                  Upgrade your plan to unlock all personalized pronunciation, grammar, and vocabulary suggestions!
                </Text>
                <View style={styles.upgradePromptActionRow}>
                  <Text style={styles.upgradePromptActionText}>Unlock All Suggestions →</Text>
                </View>
              </View>
            </Pressable>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View
          style={[
            styles.bottomSection,
            isPhone && styles.bottomSectionPhone,
            {
              paddingBottom: Math.max(
                insets.bottom + 4,
                Platform.select({ web: isPhone ? 12 : 24, default: 16 })
              ),
            },
          ]}
        >
          {Platform.OS === 'web' && (
            <style dangerouslySetInnerHTML={{ __html: PARTICLE_ANIMATION_CSS }} />
          )}

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.primaryButton,
              isPhone && styles.primaryButtonPhone,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            {/* Shimmer sweep ray */}
            {Platform.OS === 'web' && (
              <View style={styles.shimmerRay} />
            )}

            {/* Glowing floating particles */}
            {GLOW_PARTICLES.map((p) => (
              <GlowingParticle key={p.id} p={p} />
            ))}

            {/* Button label & arrow */}
            <View style={styles.buttonContentRow}>
              <Text style={[styles.primaryButtonText, isPhone && styles.primaryButtonTextPhone]}>
                {isLastCard ? 'Finish Review' : 'Understood'}
              </Text>
              <Feather name="arrow-right" size={isPhone ? 18 : 20} color="#ffffff" style={styles.buttonArrow} />
            </View>
          </Pressable>

          <Pressable
            onPress={handleSkipAll}
            style={({ pressed }) => [
              styles.skipButton,
              isPhone && styles.skipButtonPhone,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.skipButtonText, isPhone && styles.skipButtonTextPhone]}>Skip all</Text>
          </Pressable>
        </View>

        {/* Upgrade Modal for unlocking all review suggestions */}
        <CommonPopup
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          preset="unlock-premium"
          title="Unlock All Review Suggestions"
          titleHighlight="All Review Suggestions"
          subtitle={`You have ${rawTotalCount - 1} more personalized speaking suggestions from this session waiting for you. Upgrade to unlock full reviews and detailed analytics!`}
          primaryButtonText="Upgrade Your Plan"
          onPrimaryPress={() => {
            setShowUpgradeModal(false);
            router.push('/upgrade');
          }}
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100dvh',
        overflow: 'hidden',
      } as any,
    }),
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
      } as any,
    }),
  },
  containerDesktop: {
    maxWidth: 440,
    alignSelf: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegmentsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressSegmentPill: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  progressSegmentActive: {
    backgroundColor: '#0284C7',
  },
  progressSegmentInactive: {
    backgroundColor: '#E2E8F0',
  },
  counterText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14,
    color: '#64748B',
    minWidth: 32,
    textAlign: 'right',
  },
  /* Scroll Body */
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: 0,
        flexShrink: 1,
      } as any,
    }),
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  /* Category Pill & Speaking Indicator */
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  categoryBadgeText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  speakingIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  speakingIndicatorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#0284C7',
  },
  introReplayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Headline & Subtitle */
  mainTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 27,
    lineHeight: 33,
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  mainTitleDesktop: {
    fontSize: 29,
    lineHeight: 35,
  },
  subTitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 24,
  },
  subTitleDesktop: {
    fontSize: 15,
  },
  /* Card 1: You Said */
  cardPeach: {
    backgroundColor: '#FFF5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    padding: 18,
  },
  cardLabelPeach: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#1E293B',
  },
  /* Card 2: A Better Way */
  cardGreen: {
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: 18,
  },
  cardLabelGreen: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#047857',
  },
  /* Card 3: Why Explanation */
  cardBlue: {
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    padding: 18,
    marginTop: 16,
  },
  cardLabelBlue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#0369A1',
  },
  /* Shared Card Elements */
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speakerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.12)',
    ...Platform.select({
      default: {
        elevation: 2,
      },
    }),
  },
  speakerButtonActive: {
    backgroundColor: '#0284C7',
  },
  speakerButtonActiveGreen: {
    backgroundColor: '#059669',
  },
  cardBodyTextWrapper: {
    paddingTop: 2,
  },
  cardSentenceText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15.5,
    lineHeight: 23,
    color: '#0F172A',
  },
  pinkHighlightTag: {
    ...fontStyle('outfit', 'bold'),
    color: '#BE123C',
    backgroundColor: '#FFE4E6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  greenHighlightTag: {
    ...fontStyle('outfit', 'bold'),
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  pronunciationTargetWord: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 21,
    lineHeight: 28,
    color: '#0F172A',
  },
  targetWordRed: {
    color: '#E11D48',
  },
  targetWordGreen: {
    color: '#16A34A',
  },
  phoneticDetailText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  ipaText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#334155',
    marginTop: 4,
  },
  whyExplanationText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    lineHeight: 21,
    color: '#475569',
  },
  /* Connector Arrow */
  connectorRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  connectorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Bottom Buttons */
  bottomSection: {
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  primaryButton: {
    position: 'relative',
    height: 56,
    backgroundColor: '#006BE5',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 107, 229, 0.42), 0 0 16px rgba(56, 189, 248, 0.35)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #087FF5 0%, #006BE5 100%)',
        animationKeyframes: 'mayaButtonGlowPulse',
        animationDuration: '3s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.1s ease',
      } as any,
      default: {
        elevation: 6,
      },
    }),
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  shimmerRay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 50%, transparent 100%)',
        animationKeyframes: 'mayaShimmerSweep',
        animationDuration: '3.5s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      } as any,
    }),
  },
  glowParticle: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
    pointerEvents: 'none',
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    pointerEvents: 'none',
  },
  primaryButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 17,
    color: '#ffffff',
  },
  buttonArrow: {
    marginLeft: 8,
  },
  skipButton: {
    height: 52,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  skipButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#2563EB',
  },
  /* Mobile Phone specific scalings */
  containerPhone: {
    paddingHorizontal: 16,
  },
  headerRowPhone: {
    paddingVertical: 10,
  },
  scrollContentPhone: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  badgeRowPhone: {
    marginBottom: 10,
  },
  categoryBadgePhone: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  categoryBadgeTextPhone: {
    fontSize: 12.5,
  },
  mainTitlePhone: {
    fontSize: 21,
    lineHeight: 26,
    marginBottom: 4,
  },
  subTitlePhone: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardCompact: {
    padding: 12,
    borderRadius: 16,
  },
  cardLabelPhone: {
    fontSize: 13.5,
  },
  speakerButtonPhone: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cardSentenceTextPhone: {
    fontSize: 14,
    lineHeight: 20,
  },
  whyExplanationTextPhone: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  connectorRowPhone: {
    marginVertical: 4,
  },
  connectorCirclePhone: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  bottomSectionPhone: {
    paddingTop: 8,
    gap: 8,
  },
  primaryButtonPhone: {
    height: 48,
    borderRadius: 18,
  },
  primaryButtonTextPhone: {
    fontSize: 15.5,
  },
  skipButtonPhone: {
    height: 42,
    borderRadius: 18,
  },
  skipButtonTextPhone: {
    fontSize: 14.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  upgradePromptCard: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(217, 119, 6, 0.12)' } as any,
      default: {
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  upgradePromptCardPhone: {
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  upgradePromptIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  upgradePromptTextCol: {
    flex: 1,
  },
  upgradePromptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  upgradePromptTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#92400E',
  },
  upgradeProBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  upgradeProBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  upgradePromptDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    lineHeight: 18,
    color: '#78350F',
    marginBottom: 8,
  },
  upgradePromptActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradePromptActionText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#B45309',
  },
});
