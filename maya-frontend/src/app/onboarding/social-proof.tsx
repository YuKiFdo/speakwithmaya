import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
} from '@/services/sound/sound-service';
import { CallSessionStore } from '@/services/store/call-session-store';
import { authService } from '@/services/auth/auth-service';
import { OnboardingStore } from '@/services/store/onboarding-store';

// 5 Separate Vector Personas for the Social Proof avatar row
const AVATAR_PROFILES = [
  {
    id: 1,
    bgColor: '#FEF3C7', // Warm amber
    skinColor: '#FBBF24',
    hairColor: '#451A03',
    shirtColor: '#1E293B',
    accent: '#3B82F6',
    glasses: true,
  },
  {
    id: 2,
    bgColor: '#FCE7F3', // Rose peach
    skinColor: '#F472B6',
    hairColor: '#831843',
    shirtColor: '#0F172A',
    accent: '#EC4899',
    glasses: false,
  },
  {
    id: 3,
    bgColor: '#D1FAE5', // Mint emerald
    skinColor: '#34D399',
    hairColor: '#064E3B',
    shirtColor: '#334155',
    accent: '#10B981',
    glasses: false,
  },
  {
    id: 4,
    bgColor: '#EDE9FE', // Soft lilac
    skinColor: '#A78BFA',
    hairColor: '#4C1D95',
    shirtColor: '#1E1B4B',
    accent: '#8B5CF6',
    glasses: false,
  },
  {
    id: 5,
    bgColor: '#E0F2FE', // Sky blue
    skinColor: '#38BDF8',
    hairColor: '#0C4A6E',
    shirtColor: '#1E3A8A',
    accent: '#0284C7',
    glasses: false,
  },
];

function VectorAvatarItem({ profile, size = 42 }: { profile: typeof AVATAR_PROFILES[0]; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      {/* Background Circle */}
      <Circle cx="22" cy="22" r="22" fill={profile.bgColor} />

      {/* Body / Shoulders */}
      <Path
        d="M 6 44 C 6 34, 13 28, 22 28 C 31 28, 38 34, 38 44 Z"
        fill={profile.shirtColor}
      />

      {/* Neck */}
      <Rect x="18" y="22" width="8" height="8" rx="2" fill={profile.skinColor} />

      {/* Head */}
      <Circle cx="22" cy="18" r="9" fill={profile.skinColor} />

      {/* Hair */}
      <Path
        d="M 13 17 C 13 10, 16 7, 22 7 C 28 7, 31 10, 31 17 C 31 18, 29 14, 27 14 C 23 14, 21 16, 17 15 C 15 15, 13 18, 13 17 Z"
        fill={profile.hairColor}
      />

      {/* Eyes & Smile */}
      <Circle cx="19" cy="18" r="1.2" fill="#1E293B" />
      <Circle cx="25" cy="18" r="1.2" fill="#1E293B" />
      <Path
        d="M 20 22 Q 22 24.5 24 22"
        stroke="#1E293B"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Glasses if applicable */}
      {profile.glasses && (
        <G stroke="#1E293B" strokeWidth="1" fill="none">
          <Circle cx="18.5" cy="18" r="3" />
          <Circle cx="25.5" cy="18" r="3" />
          <Line x1="21.5" y1="18" x2="22.5" y2="18" />
        </G>
      )}
    </Svg>
  );
}

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

  // Separate Avatar Circle Animations (5 separate animated values)
  const avatarAnims = useRef(
    AVATAR_PROFILES.map(() => ({
      scale: new Animated.Value(0),
      translateY: new Animated.Value(12),
    }))
  ).current;

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

    // 3. Social Proof Section entrance at ~450ms
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
    }, 450);

    // 4. Staggered Avatar Circles pop-in starts at ~650ms (independent timer, before button)
    const avatarTimers: ReturnType<typeof setTimeout>[] = [];
    AVATAR_PROFILES.forEach((_, i) => {
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.spring(avatarAnims[i].scale, {
            toValue: 1,
            friction: 5,
            tension: 65,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(avatarAnims[i].translateY, {
            toValue: 0,
            friction: 6,
            tension: 50,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }, 650 + i * 80); // Avatars appear at 650, 730, 810, 890, 970ms
      avatarTimers.push(t);
    });

    // 5. CTA Button reveals strictly LAST at ~1250ms (all 5 avatars are already popped in)
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
    }, 1250);

    // 6. Play Maya's Gemini TTS Voice prompt after ~300ms
    const voiceTimer = setTimeout(() => {
      try {
        playMayaSocialProofPromptVoice();
      } catch {}
    }, 300);

    return () => {
      clearTimeout(cardTimer);
      clearTimeout(socialTimer);
      avatarTimers.forEach(clearTimeout);
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
    authService.syncStep('/onboarding/call');
    router.replace('/onboarding/call');
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
                      <Stop offset="0%" stopColor="#4355F9" stopOpacity="0.22" />
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
                      stroke="#4355F9"
                      strokeWidth="1.8"
                      strokeDasharray="3, 3"
                    />

                    {/* 1 month vertical line: from (288, 38) down to 158 */}
                    <Line
                      x1="288"
                      y1="38"
                      x2="288"
                      y2="158"
                      stroke="#4355F9"
                      strokeWidth="1.8"
                      strokeDasharray="3, 3"
                    />

                    {/* Smooth Continuous Trajectory Curve */}
                    <Path
                      d="M 38 142 C 100 142, 145 108, 188 98 C 228 88, 252 52, 288 38"
                      stroke="#4355F9"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Milestone 1 Dot at (38, 142) */}
                    <Circle cx="38" cy="142" r="5" fill="#4355F9" stroke="#FFFFFF" strokeWidth="2.5" />

                    {/* Milestone 2 Dot at (188, 98) */}
                    <Circle cx="188" cy="98" r="5.5" fill="#4355F9" stroke="#FFFFFF" strokeWidth="2.5" />

                    {/* Milestone 3 Dot at (288, 38) */}
                    <Circle cx="288" cy="38" r="6" fill="#4355F9" stroke="#FFFFFF" strokeWidth="2.5" />
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
                    <Rect x="146" y="50" width="84" height="32" rx="9" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1" />
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

            {/* Social Proof: "Over 10,000 people already use Maya" + 5 Separate Animated Circles */}
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

              {/* 5 Separate Animated Circles Row (No flat PNGs, individual staggered spring animations) */}
              <View style={styles.avatarsRow}>
                {AVATAR_PROFILES.map((profile, index) => {
                  const anim = avatarAnims[index];
                  return (
                    <Animated.View
                      key={profile.id}
                      style={[
                        styles.avatarCircleWrapper,
                        index > 0 && styles.avatarOverlap,
                        {
                          zIndex: index + 1,
                          transform: [
                            { scale: anim.scale },
                            { translateY: anim.translateY },
                          ],
                        },
                      ]}
                    >
                      <VectorAvatarItem profile={profile} size={42} />
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          </StepTransition>
        </ScrollView>

        {/* Fixed Bottom CTA Button (Pinned to bottom of screen, appears LAST) */}
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
            showArrow={false}
            onPress={handleStartSpeaking}
            height={56}
            borderRadius={24}
          />
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
    color: '#4338CA',
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
    marginTop: 2,
  },
  socialCountText: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 28,
    lineHeight: 42,
    color: '#4338CA',
    textAlign: 'center',
    letterSpacing: -0.84,
  },
  socialSubText: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 16,
    lineHeight: 26,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.84,
    marginBottom: 12,
  },

  /* Separate Avatar Circles Row */
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  avatarCircleWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  avatarOverlap: {
    marginLeft: -10,
  },

  /* Bottom CTA */
  fixedBottomButtonWrapper: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 8 : 4,
  },
});
