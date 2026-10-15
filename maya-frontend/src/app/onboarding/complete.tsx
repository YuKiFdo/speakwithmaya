import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getLatestSessionReport, ExtendedSessionReport } from '@/utils/session-report-store';
import { playUnderstoodTapSound, playFinishReviewFanfare, playGoodJobSound } from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

const GLOW_PARTICLES = [
  { id: 1, left: '12%', top: '65%', size: 4, delay: '0s', duration: '2.5s' },
  { id: 2, left: '26%', top: '75%', size: 3, delay: '0.6s', duration: '2.8s' },
  { id: 3, left: '42%', top: '55%', size: 5, delay: '1.2s', duration: '2.3s' },
  { id: 4, left: '60%', top: '70%', size: 3.5, delay: '0.3s', duration: '2.7s' },
  { id: 5, left: '76%', top: '60%', size: 4.5, delay: '1.7s', duration: '2.4s' },
  { id: 6, left: '88%', top: '72%', size: 3, delay: '0.9s', duration: '2.9s' },
  { id: 7, left: '34%', top: '40%', size: 3, delay: '1.4s', duration: '2.2s' },
  { id: 8, left: '68%', top: '35%', size: 4, delay: '2.0s', duration: '2.6s' },
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

const COMPLETE_ANIMATION_CSS = `
@keyframes completeFadeUp {
  0% {
    opacity: 0;
    transform: translateY(24px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes completeAvatarPop {
  0% {
    opacity: 0;
    transform: scale(0.78) translateY(20px);
  }
  65% {
    transform: scale(1.04) translateY(-3px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

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

export default function SessionCompleteScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    roadmapLevelId?: string;
    levelNumber?: string;
    levelTitle?: string;
    durationSeconds?: string;
    talkTimeSeconds?: string;
    overallScore?: string;
    passed?: string;
    feedbackSinhala?: string;
    feedbackEnglish?: string;
    userSentencesCount?: string;
    xpEarned?: string;
    isGeneralChat?: string;
    callParams?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Dynamic avatar size: scales with screen height to fill vertical gap, safely bounded by width
  const avatarSize = useMemo(() => {
    // Proportional to screen height (~38.5%) to close the empty gap above action buttons
    const heightBased = Math.round(windowHeight * 0.385);
    // Width constraint: ensure avatar stays within safe horizontal bounds
    const maxSafeWidth = Math.round(windowWidth - 56);
    return Math.min(340, maxSafeWidth, Math.max(220, heightBased));
  }, [windowHeight, windowWidth]);

  const parseReportFromParams = (): ExtendedSessionReport => {
    let parsedCallParams: any = undefined;
    if (params.callParams) {
      try {
        parsedCallParams = JSON.parse(params.callParams);
      } catch { }
    }

    const durationSecs = params.durationSeconds ? parseInt(params.durationSeconds, 10) : 180;
    const talkSecs = params.talkTimeSeconds ? parseInt(params.talkTimeSeconds, 10) : durationSecs;
    const scoreVal = params.overallScore ? parseInt(params.overallScore, 10) : 75;
    const isPassedVal = params.passed !== undefined ? params.passed === 'true' : true;
    const isGeneralVal = params.isGeneralChat === 'true' || !params.roadmapLevelId;
    const sentencesVal = params.userSentencesCount ? parseInt(params.userSentencesCount, 10) : 0;
    const xpVal = params.xpEarned ? parseInt(params.xpEarned, 10) : (isGeneralVal ? 50 : (isPassedVal ? 100 : 0));

    return {
      roadmapLevelId: params.roadmapLevelId || '',
      levelNumber: params.levelNumber ? parseInt(params.levelNumber, 10) : undefined,
      levelTitle: params.levelTitle || 'Practice Session',
      durationSeconds: durationSecs,
      talkTimeSeconds: talkSecs,
      overallScore: scoreVal,
      passed: isPassedVal,
      passReason: '',
      feedbackSinhala: params.feedbackSinhala,
      feedbackEnglish: params.feedbackEnglish,
      userSentencesCount: sentencesVal,
      xpEarned: xpVal,
      isGeneralChat: isGeneralVal,
      objectives: [],
      corrections: [],
      callParams: parsedCallParams,
    };
  };

  const report = useMemo<ExtendedSessionReport>(() => {
    const stored = getLatestSessionReport();
    if (stored) return stored;
    return parseReportFromParams();
  }, [
    params.roadmapLevelId,
    params.levelNumber,
    params.levelTitle,
    params.durationSeconds,
    params.talkTimeSeconds,
    params.overallScore,
    params.passed,
    params.userSentencesCount,
    params.xpEarned,
    params.isGeneralChat,
    params.callParams,
  ]);

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const isPassed = report ? report.passed : true;
  const isGeneral = report ? Boolean(report.isGeneralChat) : true;

  // Time metrics
  const totalSecs = report?.durationSeconds || 180;
  const sessionMins = Math.floor(totalSecs / 60);
  const sessionRemSecs = totalSecs % 60;
  const formattedSessionTime = `${String(sessionMins).padStart(2, '0')}:${String(sessionRemSecs).padStart(2, '0')}`;

  const talkSecs = report?.talkTimeSeconds || totalSecs;
  const talkMins = Math.max(1, Math.round(talkSecs / 60));

  // XP & Sentences
  const xpEarned = report?.xpEarned ?? (isGeneral ? (isPassed ? 50 : 0) : (isPassed ? 100 : 0));
  const sentencesCount = report?.userSentencesCount ?? 0;
  const overallScore = report?.overallScore ?? (isGeneral ? 85 : 75);

  // Avatar source: Celebrate when passed/general, sad Maya when failed on roadmap
  const avatarSource = isPassed
    ? require('@/assets/images/maya-celebrate.png')
    : require('@/assets/images/maya-sad.png');

  // Headings
  const titleText = isGeneral
    ? (isPassed ? 'Great job! 🎉' : 'Session Ended Early')
    : (isPassed ? 'Great job! 🎉' : 'Needs a Bit More Practice! 💪');

  // Subtitle / Feedback
  let subtitleText = isGeneral
    ? (isPassed
      ? 'You expressed your ideas clearly. Now let\'s make your English sound even more natural and fluent.'
      : 'You ended the call before practicing. Whenever you\'re ready, come back and practice speaking with Maya!')
    : 'Keep practicing! Review your errors below and try again to master this level.';
  if (!isGeneral && report) {
    if (report.feedbackSinhala) {
      subtitleText = report.feedbackSinhala;
    } else if (report.feedbackEnglish) {
      subtitleText = report.feedbackEnglish;
    } else if (isPassed) {
      subtitleText = 'You communicated naturally and met all lesson goals! Ready for the next challenge.';
    } else {
      subtitleText = 'Session ended before completing all tasks and evaluation. Try again to pass this level.';
    }
  }

  const avatarAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Play celebratory good job sound
    playGoodJobSound();

    Animated.stagger(90, [
      Animated.spring(avatarAnim, {
        toValue: 1,
        friction: 5.5,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(buttonAnim, {
        toValue: 1,
        friction: 6.5,
        tension: 75,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  // Button handlers
  const handlePrimaryPress = () => {
    playUnderstoodTapSound();
    const activeSessionId = params.sessionId || report?.id || (report as any)?.sessionId || '';
    if (isGeneral) {
      OnboardingStore.setOnboardingCompleted();
      authService.syncStep('/(tabs)/dashboard');
      router.replace('/(tabs)/dashboard');
      return;
    }

    if (isPassed) {
      router.replace({
        pathname: '/onboarding/session-review' as any,
        params: {
          sessionId: activeSessionId,
          roadmapLevelId: params.roadmapLevelId || '',
          isGeneral: 'false',
          isPassed: 'true',
        },
      });
    } else {
      // Re-attempt level cleanly through /call
      if (report?.callParams) {
        router.replace({
          pathname: '/call' as any,
          params: report.callParams,
        });
      } else {
        router.replace('/call' as any);
      }
    }
  };

  const handleSecondaryPress = () => {
    playUnderstoodTapSound();
    router.replace('/(tabs)/roadmap');
  };

  const primaryButtonText = isGeneral
    ? 'Done'
    : (isPassed ? 'Done' : 'Try Again');

  const secondaryButtonText = isGeneral
    ? 'Back to home'
    : (isPassed ? 'Back to home' : 'Back to Roadmap');

  const totalObjectives = report?.objectives?.length || 0;
  const passedObjectives = report?.objectives?.filter((o: any) => o.status === 'mastered').length || 0;
  const hasReviewItems = (report?.objectives && report.objectives.length > 0) || (report?.corrections && report.corrections.length > 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{ __html: COMPLETE_ANIMATION_CSS }} />
      )}
      <View style={[styles.mainWrapper, !isPhone && styles.mainWrapperDesktop]}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Content (Avatar, Title, Metrics) */}
          <View style={styles.topContentGroup}>
            {/* Top Maya Avatar with Soft Radial Background Aura */}
            <Animated.View
              style={[
                styles.avatarSection,
                {
                  width: avatarSize + 20,
                  height: avatarSize,
                  opacity: avatarAnim,
                  transform: [
                    {
                      scale: avatarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.72, 1],
                      }),
                    },
                    {
                      translateY: avatarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.avatarGlowCircle,
                  isPassed ? styles.avatarGlowPassed : styles.avatarGlowRetry,
                  {
                    width: Math.round(avatarSize * 0.85),
                    height: Math.round(avatarSize * 0.85),
                    borderRadius: Math.round(avatarSize * 0.85) / 2,
                    top: Math.round(avatarSize * 0.08),
                  },
                ]}
              />
              <Image
                source={avatarSource}
                style={[styles.avatarImage, { width: avatarSize, height: avatarSize }]}
                resizeMode="contain"
                accessibilityLabel={isPassed ? 'Maya celebrating' : 'Maya encouraging you to try again'}
              />
              {/* White gradient fade blend at bottom to dissolve into surface */}
              <View
                style={[styles.imageBottomFade, { height: Math.round(avatarSize * 0.24) }]}
              >
                <Svg width="100%" height="100%" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient
                      id="whiteFadeBlendComplete"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                      <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.8" />
                      <Stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#whiteFadeBlendComplete)" />
                </Svg>
              </View>
            </Animated.View>

            {/* Heading and Subtitle */}
            <Animated.View
              style={[
                styles.titleSection,
                {
                  opacity: titleAnim,
                  transform: [
                    {
                      translateY: titleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.title}>{titleText}</Text>
              <Text style={styles.subtitle}>{report?.feedbackEnglish || subtitleText}</Text>
            </Animated.View>

            {/* Stats Group Animated entrance */}
            <Animated.View
              style={{
                width: '100%',
                alignItems: 'center',
                opacity: statsAnim,
                transform: [
                  {
                    translateY: statsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }}
            >
              {/* Row 1: Talk Time & XP Earned Pill Cards */}
              <View style={styles.rowOneStats}>
                {/* Talk Time */}
                <View style={styles.pillStatCard}>
                  <View style={styles.clockIconBadge}>
                    <Ionicons name="time-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statValueBold}>{talkMins} min</Text>
                    <Text style={styles.statLabelMuted}>Talk time</Text>
                  </View>
                </View>

                {/* XP Earned */}
                <View style={styles.pillStatCard}>
                  <View style={styles.starIconBadge}>
                    <Ionicons name="star" size={18} color="#EAB308" />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statValueBold}>+{xpEarned} XP</Text>
                    <Text style={styles.statLabelMuted}>Earned today</Text>
                  </View>
                </View>
              </View>

              {/* Row 2: 3-Metric Summary Card (Session Time | Sentences | Score) */}
              <View style={styles.threeMetricCard}>
                {/* Column 1: Session Time */}
                <View style={styles.metricColumn}>
                  <View style={styles.metricIconBadge}>
                    <Ionicons name="time-outline" size={17} color="#3B82F6" />
                  </View>
                  <Text style={styles.metricValueText}>{formattedSessionTime}</Text>
                  <Text style={styles.metricLabelText}>Session time</Text>
                </View>

                {/* Divider Line */}
                <View style={styles.metricDivider} />

                {/* Column 2: Sentences Spoken */}
                <View style={styles.metricColumn}>
                  <View style={styles.metricIconBadge}>
                    <Ionicons name="chatbubble-ellipses-outline" size={17} color="#3B82F6" />
                  </View>
                  <Text style={styles.metricValueText}>{sentencesCount}</Text>
                  <Text style={styles.metricLabelText}>Sentences</Text>
                </View>

                {/* Divider Line */}
                <View style={styles.metricDivider} />

                {/* Column 3: Score % */}
                <View style={styles.metricColumn}>
                  <View
                    style={[
                      styles.metricIconBadge,
                      !isPassed && !isGeneral && styles.metricIconBadgeRetry,
                    ]}
                  >
                    <Ionicons
                      name="star"
                      size={17}
                      color={isPassed || isGeneral ? '#3B82F6' : '#D97706'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.metricValueText,
                      !isPassed && !isGeneral && styles.metricValueTextRetry,
                    ]}
                  >
                    {overallScore}%
                  </Text>
                  <Text style={styles.metricLabelText}>
                    {isGeneral ? 'Fluency Score' : 'Roleplay Score'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Action Buttons (Pinned at Bottom) */}
          <Animated.View
            style={[
              styles.actionButtonsContainer,
              {
                opacity: buttonAnim,
                transform: [
                  {
                    translateY: buttonAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Primary Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handlePrimaryPress}
              accessibilityRole="button"
            >
              {/* Shimmer sweep ray */}
              {Platform.OS === 'web' && (
                <View style={styles.shimmerRay} />
              )}

              {/* Glowing floating particles */}
              {GLOW_PARTICLES.map((p) => (
                <GlowingParticle key={p.id} p={p} />
              ))}

              <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
            </Pressable>

            {!isPassed && !isGeneral && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={handleSecondaryPress}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  mainWrapperDesktop: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: Platform.select({
      web: 42,
      ios: 36,
      default: 34,
    }),
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topContentGroup: {
    width: '100%',
    alignItems: 'center',
  },

  /* Avatar Presentation */
  avatarSection: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  avatarGlowCircle: {
    position: 'absolute',
  },
  avatarGlowPassed: {
    backgroundColor: '#EFF6FF',
  },
  avatarGlowRetry: {
    backgroundColor: '#FEF3C7',
  },
  avatarImage: {
    alignSelf: 'center',
  },
  imageBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },

  /* Title & Subtitle */
  titleSection: {
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 3,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  secondarySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 12,
  },

  /* Row 1: Pill Stat Cards */
  rowOneStats: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    ...Platform.select({
      web: {
        animationKeyframes: 'completeFadeUp',
        animationDuration: '0.65s',
        animationDelay: '0.28s',
        animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        animationFillMode: 'both',
      } as any,
    }),
  },
  pillStatCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clockIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF9C3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTexts: {
    flex: 1,
    justifyContent: 'center',
  },
  statValueBold: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabelMuted: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
  },

  /* Row 2: 3-Metric Summary Card */
  threeMetricCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      web: {
        animationKeyframes: 'completeFadeUp',
        animationDuration: '0.65s',
        animationDelay: '0.38s',
        animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        animationFillMode: 'both',
      } as any,
    }),
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  metricIconBadgeRetry: {
    backgroundColor: '#FEF3C7',
  },
  metricValueText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0F172A',
  },
  metricValueTextRetry: {
    color: '#D97706',
  },
  metricLabelText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
  },
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E2E8F0',
  },

  /* Action Buttons */
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
    paddingTop: 12,
    marginBottom: Platform.select({
      web: 24,
      ios: 12,
      default: 12,
    }),
    ...Platform.select({
      web: {
        animationKeyframes: 'completeFadeUp',
        animationDuration: '0.65s',
        animationDelay: '0.48s',
        animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        animationFillMode: 'both',
      } as any,
    }),
  },
  primaryButton: {
    position: 'relative',
    width: '100%',
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
  primaryButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 17,
    color: '#ffffff',
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
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: '#EFF6FF',
    opacity: 0.9,
  },
  secondaryButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#2563EB',
  },

  /* Collapsible Review Accordion */
  reviewAccordionContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 6,
  },
  reviewAccordionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionHeaderText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#475569',
  },
  reviewAccordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    gap: 10,
  },
  taskItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  taskItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  taskItemTitle: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taskStatusBadgePassed: {
    backgroundColor: '#ECFDF5',
  },
  taskStatusBadgeGuided: {
    backgroundColor: '#FEF3C7',
  },
  taskStatusText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  taskStatusTextPassed: {
    color: '#059669',
  },
  taskStatusTextGuided: {
    color: '#D97706',
  },
  taskItemNote: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  correctionsBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  correctionsBoxTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
  },
  correctionRow: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 2,
  },
  correctionOriginal: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#DC2626',
  },
  correctionBetter: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#059669',
  },
  correctionExpl: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
