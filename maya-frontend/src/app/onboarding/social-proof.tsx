import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  ClipPath,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { MayaPrimaryButton } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import {
  playMayaSocialProofPromptVoice,
  stopMayaSocialProofPromptVoice,
  playOtherButtonSound,
} from '@/services/sound/sound-service';
import { CallSessionStore } from '@/services/store/call-session-store';
import { authService } from '@/services/auth/auth-service';
import { OnboardingStore } from '@/services/store/onboarding-store';

export default function SocialProofScreen() {
  const { isDesktop, isTablet } = useBreakpoint();

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(16)).current;

  const socialOpacityAnim = useRef(new Animated.Value(0)).current;
  const socialSlideAnim = useRef(new Animated.Value(16)).current;

  const buttonOpacityAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(14)).current;

  // Chart Progressive Reveal Animation (Clip width 0 -> 320)
  const chartRevealAnim = useRef(new Animated.Value(0)).current;
  const [chartWidth, setChartWidth] = useState(0);

  // Milestone callout pill visibility states
  const [m1Visible, setM1Visible] = useState(false);
  const [m2Visible, setM2Visible] = useState(false);
  const [m3Visible, setM3Visible] = useState(false);

  useEffect(() => {
    // 1. Header entrance immediately on mount
    Animated.parallel([
      Animated.timing(headerOpacityAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(headerSlideAnim, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // 2. Card entrance at ~120ms
    const cardTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(cardSlideAnim, {
          toValue: 0,
          friction: 7,
          tension: 45,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      // Start progressive chart drawing as card enters
      startChartAnimation();
    }, 120);

    // 3. Social Proof Section entrance at ~420ms
    const socialTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(socialOpacityAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(socialSlideAnim, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, 420);

    // 4. CTA Button & Skip option reveal smoothly at ~620ms
    const buttonTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonOpacityAnim, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(buttonSlideAnim, {
          toValue: 0,
          friction: 7,
          tension: 45,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, 620);

    // 5. Play Maya's Gemini TTS Voice prompt after ~300ms
    const voiceTimer = setTimeout(() => {
      try {
        playMayaSocialProofPromptVoice();
      } catch {}
    }, 300);

    return () => {
      clearTimeout(cardTimer);
      clearTimeout(socialTimer);
      clearTimeout(buttonTimer);
      clearTimeout(voiceTimer);
      stopMayaSocialProofPromptVoice();
    };
  }, []);

  // Chart Progressive Draw Animation
  const startChartAnimation = () => {
    chartRevealAnim.setValue(0);
    const listenerId = chartRevealAnim.addListener(({ value }) => {
      setChartWidth(value);
      if (value >= 38) setM1Visible(true);
      if (value >= 188) setM2Visible(true);
      if (value >= 288) setM3Visible(true);
    });

    Animated.timing(chartRevealAnim, {
      toValue: 320,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      chartRevealAnim.removeListener(listenerId);
    });
  };

  const handleStartSpeaking = () => {
    stopMayaSocialProofPromptVoice();
    const state = OnboardingStore.getState();
    const effectiveName = (state.name || state.user?.displayName || '').trim() || 'Learner';
    const effectiveDailyGoal = state.dailyGoalMinutes ? `${state.dailyGoalMinutes}-min` : '10-min';

    CallSessionStore.setConfig({
      topic: 'Introductory Practice',
      durationSeconds: 180,
      isIntroCall: true,
      userName: effectiveName,
      goal: state.goal,
      challenge: state.challenge,
      level: state.level || 'Intermediate',
      dailyGoal: effectiveDailyGoal,
      employment: state.employment,
      phone: state.phone || state.user?.phoneNumber,
      languageMode: 'sinhala',
      sinhalaStyle: 'balanced',
    });

    // Save preferences and sync active step when entering the intro call
    authService.savePreferences({
      displayName: state.name || undefined,
      nativeLanguage: state.nativeLanguage,
      level: state.level,
      goal: state.goal,
      challenge: state.challenge,
      employmentStatus: state.employment,
      dailyGoalMinutes: state.dailyGoalMinutes,
    }).catch(() => {});
    authService.syncStep('/onboarding/call');
    router.replace('/onboarding/call');
  };

  const handleSkipForNow = () => {
    try {
      playOtherButtonSound();
    } catch {}
    stopMayaSocialProofPromptVoice();
    const state = OnboardingStore.getState();

    authService.savePreferences({
      displayName: state.name || undefined,
      nativeLanguage: state.nativeLanguage,
      level: state.level,
      goal: state.goal,
      challenge: state.challenge,
      employmentStatus: state.employment,
      dailyGoalMinutes: state.dailyGoalMinutes,
    }).catch(() => {});
    authService.syncStep('/onboarding/building-plan');
    router.replace('/onboarding/building-plan' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.container,
          (isTablet || isDesktop) && styles.desktopContainer,
        ]}
      >
        {/* Top Progress Bar (~50% to match design) */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.5} />
        </View>

        {/* Scrollable Center Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <StepTransition style={styles.body}>
            {/* Header: Title & Subtitle */}
            <Animated.View
              style={[
                styles.headerWrapper,
                {
                  opacity: headerOpacityAnim,
                  transform: [{ translateY: headerSlideAnim }],
                },
              ]}
            >
              <Text style={styles.mainTitle}>
                See your progress{'\n'}
                in <Text style={styles.titleHighlight}>just 2 weeks!</Text>
              </Text>

              <Text style={styles.subtitle}>
                The more you practice, the more{'\n'}confident you'll become.
              </Text>
            </Animated.View>

            {/* Speaking Progress Card (With Vector Animated Graph) */}
            <Animated.View
              style={[
                styles.chartCard,
                {
                  opacity: cardOpacityAnim,
                  transform: [{ translateY: cardSlideAnim }],
                },
              ]}
            >
              <Text style={styles.chartTitle}>Your speaking progress</Text>

              {/* Vector Svg Chart Canvas with Tooltip Pills Layer */}
              <View style={styles.chartCanvasWrapper}>
                <Svg width="100%" height="195" viewBox="0 0 320 195">
                  <Defs>
                    {/* Linear Gradient for Curve Area Fill */}
                    <LinearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                      <Stop offset="80%" stopColor="#60A5FA" stopOpacity="0.06" />
                      <Stop offset="100%" stopColor="#EFF6FF" stopOpacity="0.0" />
                    </LinearGradient>

                    {/* Dynamic Reveal Clip Path (Progressively draws from left to right) */}
                    <ClipPath id="chartClip">
                      <Rect x="0" y="0" width={chartWidth} height="195" />
                    </ClipPath>
                  </Defs>

                  {/* Horizontal Faint Grid Reference Lines */}
                  {/* 100% */}
                  <Line x1="42" y1="32" x2="295" y2="32" stroke="#F1F5F9" strokeWidth="1.2" />
                  {/* 75% */}
                  <Line x1="42" y1="74" x2="295" y2="74" stroke="#F1F5F9" strokeWidth="1.2" />
                  {/* 25% */}
                  <Line x1="42" y1="142" x2="295" y2="142" stroke="#F1F5F9" strokeWidth="1.2" />

                  {/* Y-axis Percentage Labels */}
                  <G opacity={0.75}>
                    <SvgText x="12" y="35" fontSize="10" fill="#94A3B8" fontWeight="500">100%</SvgText>
                    <SvgText x="16" y="77" fontSize="10" fill="#94A3B8" fontWeight="500">75%</SvgText>
                    <SvgText x="16" y="145" fontSize="10" fill="#94A3B8" fontWeight="500">25%</SvgText>
                  </G>

                  {/* Progressive Revealed Curve & Fill via ClipPath */}
                  <G clipPath="url(#chartClip)">
                    {/* Area Fill Under Curve */}
                    <Path
                      d="M 38 142 C 100 142, 145 108, 188 98 C 228 88, 252 52, 288 38 L 288 158 L 38 158 Z"
                      fill="url(#curveGradient)"
                    />

                    {/* Dotted Vertical Guide Lines */}
                    {/* 2 weeks vertical line: from (188, 98) down to 158 */}
                    <Line
                      x1="188"
                      y1="98"
                      x2="188"
                      y2="158"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      strokeDasharray="3, 3"
                    />

                    {/* 1 month vertical line: from (288, 38) down to 158 */}
                    <Line
                      x1="288"
                      y1="38"
                      x2="288"
                      y2="158"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      strokeDasharray="3, 3"
                    />

                    {/* Smooth Continuous Trajectory Curve */}
                    <Path
                      d="M 38 142 C 100 142, 145 108, 188 98 C 228 88, 252 52, 288 38"
                      stroke="#2563EB"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Milestone 1 Dot at (38, 142) */}
                    <Circle cx="38" cy="142" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />

                    {/* Milestone 2 Dot at (188, 98) */}
                    <Circle cx="188" cy="98" r="5.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />

                    {/* Milestone 3 Dot at (288, 38) */}
                    <Circle cx="288" cy="38" r="6" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />
                  </G>

                  {/* Base Axis Line */}
                  <Line x1="38" y1="158" x2="295" y2="158" stroke="#E2E8F0" strokeWidth="1" />

                  {/* X-axis Time Labels */}
                  <G opacity={0.85}>
                    <SvgText x="38" y="178" fontSize="11" fill="#64748B" textAnchor="middle" fontWeight="500">Now</SvgText>
                    <SvgText x="114" y="178" fontSize="11" fill="#64748B" textAnchor="middle" fontWeight="500">1 week</SvgText>
                    <SvgText x="188" y="178" fontSize="11" fill="#64748B" textAnchor="middle" fontWeight="500">2 weeks</SvgText>
                    <SvgText x="288" y="178" fontSize="11" fill="#64748B" textAnchor="middle" fontWeight="500">1 month</SvgText>
                  </G>

                  {/* Milestone 1 Callout Pill ("Start speaking") directly above (38, 142) */}
                  <G opacity={m1Visible ? 1 : 0}>
                    <Rect x="10" y="94" width="58" height="32" rx="9" fill="#EFF6FF" stroke="#DBEAFE" strokeWidth="1" />
                    <SvgText x="39" y="107" textAnchor="middle" fontSize="9.5" fontFamily="Inter" fontWeight="400" fill="#10213D">Start</SvgText>
                    <SvgText x="39" y="119" textAnchor="middle" fontSize="9.5" fontFamily="Inter" fontWeight="400" fill="#10213D">speaking</SvgText>
                  </G>

                  {/* Milestone 2 Callout Pill ("Feel more confident") directly above (188, 98) */}
                  <G opacity={m2Visible ? 1 : 0}>
                    <Rect x="146" y="50" width="84" height="32" rx="9" fill="#EFF6FF" stroke="#DBEAFE" strokeWidth="1" />
                    <SvgText x="188" y="63" textAnchor="middle" fontSize="9.5" fontFamily="Inter" fontWeight="400" fill="#10213D">Feel more</SvgText>
                    <SvgText x="188" y="75" textAnchor="middle" fontSize="9.5" fontFamily="Inter" fontWeight="400" fill="#10213D">confident</SvgText>
                  </G>

                  {/* Milestone 3 Callout Pill ("Speak naturally in real situations") top-left of (288, 38) */}
                  <G opacity={m3Visible ? 1 : 0}>
                    <Rect x="180" y="5" width="108" height="28" rx="8" fill="#EFF6FF" stroke="#DBEAFE" strokeWidth="1" />
                    <SvgText x="234" y="16" textAnchor="middle" fontSize="9" fontFamily="Inter" fontWeight="400" fill="#10213D">Speak naturally</SvgText>
                    <SvgText x="234" y="27" textAnchor="middle" fontSize="9" fontFamily="Inter" fontWeight="400" fill="#10213D">in real situations</SvgText>
                  </G>
                </Svg>
              </View>
            </Animated.View>

            {/* Social Proof: "Over 10,000 people already use Maya" */}
            <Animated.View
              style={[
                styles.socialSection,
                {
                  opacity: socialOpacityAnim,
                  transform: [{ translateY: socialSlideAnim }],
                },
              ]}
            >
              <Text style={styles.socialCountText}>Over 10,000 people</Text>
              <Text style={styles.socialSubText}>already use Maya</Text>
            </Animated.View>
          </StepTransition>
        </ScrollView>

        {/* Fixed Bottom CTA Button & Secondary Skip Option */}
        <Animated.View
          style={[
            styles.fixedBottomButtonWrapper,
            {
              opacity: buttonOpacityAnim,
              transform: [{ translateY: buttonSlideAnim }],
            },
          ]}
        >
          <MayaPrimaryButton
            label="Start Speaking"
            showArrow={true}
            onPress={handleStartSpeaking}
            height={56}
            borderRadius={28}
          />

          <Pressable
            onPress={handleSkipForNow}
            hitSlop={10}
            style={({ pressed }) => [
              styles.skipForNowButton,
              pressed && styles.skipForNowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={styles.skipForNowText}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: Platform.OS === 'web' ? 16 : 10,
    maxWidth: 440,
    alignSelf: 'center',
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
    paddingTop: 24,
  },
  progressContainer: {
    width: '100%',
    paddingTop: 6,
    paddingBottom: 16,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  body: {
    width: '100%',
    gap: 18,
    alignItems: 'center',
  },

  /* Header Section */
  headerWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  mainTitle: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 28,
    lineHeight: 42,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.84,
  },
  titleHighlight: {
    color: '#0D4EFD',
    ...fontStyle('inter', 'extraBold'),
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'center',
  },

  /* Chart Card */
  chartCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  chartTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    lineHeight: 16,
    color: '#10213D',
    letterSpacing: -0.27,
    paddingHorizontal: 4,
  },
  chartCanvasWrapper: {
    position: 'relative',
    width: '100%',
    height: 195,
  },

  /* Social Proof Section */
  socialSection: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  socialCountText: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 28,
    lineHeight: 38,
    color: '#0D4EFD',
    textAlign: 'center',
    letterSpacing: -0.84,
  },
  socialSubText: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 16,
    lineHeight: 24,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },

  /* Bottom CTA & Skip Option */
  fixedBottomButtonWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 8 : 4,
  },
  skipForNowButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipForNowPressed: {
    opacity: 0.65,
  },
  skipForNowText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
  },
});
