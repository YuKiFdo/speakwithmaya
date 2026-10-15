import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  playScanningSound,
  stopScanningSound,
  playStepPop,
  playAnalysisCompleteSound,
} from '@/services/sound/sound-service';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { getLatestSessionReport, setLatestFeedbackItems, getLatestFeedbackItems, FeedbackItem } from '@/utils/session-report-store';
import { ActiveConversationStore } from '@/services/store/active-conversation-store';
import { warmUpSpeechVoices } from '@/utils/maya-voice-fallback';

interface AnalysisStep {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  iconType: 'feather' | 'ionicons' | 'material';
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'pronunciation',
    title: 'Analyzing pronunciation',
    subtitle: 'Checking how clearly you said each word...',
    iconName: 'graphic-eq',
    iconType: 'material',
  },
  {
    id: 'grammar',
    title: 'Checking grammar',
    subtitle: 'Finding mistakes and improvements...',
    iconName: 'document-text-outline',
    iconType: 'ionicons',
  },
  {
    id: 'rephrases',
    title: 'Creating natural rephrases',
    subtitle: 'Making your sentences sound more natural...',
    iconName: 'chatbubble-outline',
    iconType: 'ionicons',
  },
  {
    id: 'score',
    title: 'Calculating your speaking score',
    subtitle: 'Evaluating fluency, vocabulary and confidence...',
    iconName: 'bar-chart-2',
    iconType: 'feather',
  },
];

// Strip out React Native Web's synthetic collapsable attribute before passing to SVG circle on Web
const BaseCircle = Platform.OS === 'web'
  ? React.forwardRef<any, any>(({ collapsable, ...props }, ref) => <Circle ref={ref} {...props} />)
  : Circle;

if (Platform.OS === 'web') {
  (BaseCircle as any).displayName = 'WebSafeCircle';
}

const AnimatedCircle = Animated.createAnimatedComponent(BaseCircle);
const RADIUS = 98;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function AnalyzingScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Active step index (0, 1, 2, 3, 4=done)
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Circular progress fill animation (starts at ~4% and smoothly fills to 100%)
  const progressAnim = useRef(new Animated.Value(0.04)).current;
  const strokeDashoffset = useRef(
    progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [CIRCUMFERENCE, 0],
    }),
  ).current;

  // Animations for center wave bars
  const wave1Anim = useRef(new Animated.Value(0.4)).current;
  const wave2Anim = useRef(new Animated.Value(0.85)).current;
  const wave3Anim = useRef(new Animated.Value(1.0)).current;
  const wave4Anim = useRef(new Animated.Value(0.7)).current;
  const wave5Anim = useRef(new Animated.Value(0.35)).current;

  // Pulse animation for outer concentric radar rings
  const radarPulseAnim = useRef(new Animated.Value(1)).current;
  const radarRotateAnim = useRef(new Animated.Value(0)).current;

  // Celebratory circle jump & smooth screen fade-out animations
  const jumpTranslateYAnim = useRef(new Animated.Value(0)).current;
  const jumpScaleAnim = useRef(new Animated.Value(1)).current;
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const hasTriggeredJumpRef = useRef(false);

  // Checkmark spring pop animations for each of the 4 steps
  const checkPopAnims = useRef(ANALYSIS_STEPS.map(() => new Animated.Value(0))).current;

  // Staggered cascade entrance animations for the 4 step rows
  const stepFadeAnims = useRef(ANALYSIS_STEPS.map(() => new Animated.Value(0))).current;

  const triggerCompleteJump = () => {
    if (hasTriggeredJumpRef.current) return;
    hasTriggeredJumpRef.current = true;
    console.log('[AnalyzingScreen] 🚀 Triggering snappy celebratory circle jump!');
    warmUpSpeechVoices();

    Animated.parallel([
      // Vertical jump: joyful leap up (200ms) then snap land (160ms)
      Animated.sequence([
        Animated.timing(jumpTranslateYAnim, {
          toValue: -24,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(jumpTranslateYAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      // Scale pop: expand up (1.16) then snap back to normal (1.0)
      Animated.sequence([
        Animated.timing(jumpScaleAnim, {
          toValue: 1.16,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(jumpScaleAnim, {
          toValue: 1.0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      // Smooth fade-out starts during landing so there is zero dead wait time
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(screenFadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start(() => {
      // Navigate to feedback screen if AI generated items, otherwise straight to completion
      const fbItems = getLatestFeedbackItems();
      if (fbItems && fbItems.length > 0) {
        router.replace({
          pathname: '/call/feedback' as any,
          params: params as any,
        });
      } else {
        router.replace({
          pathname: '/call/complete' as any,
          params: params as any,
        });
      }
    });
  };

  // Waveform dancing loop
  useEffect(() => {
    const waveLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(wave1Anim, { toValue: 0.9, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(wave1Anim, { toValue: 0.3, duration: 340, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(wave2Anim, { toValue: 0.3, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(wave2Anim, { toValue: 1.0, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(wave3Anim, { toValue: 0.4, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(wave3Anim, { toValue: 1.0, duration: 290, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(wave4Anim, { toValue: 1.0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(wave4Anim, { toValue: 0.25, duration: 330, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(wave5Anim, { toValue: 0.8, duration: 290, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(wave5Anim, { toValue: 0.2, duration: 340, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ])
    );
    waveLoop.start();

    const radarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarPulseAnim, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(radarPulseAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    radarLoop.start();

    return () => {
      waveLoop.stop();
      radarLoop.stop();
    };
  }, []);

  // Staggered cascade entrance for the 4 step rows on screen load
  useEffect(() => {
    const entranceAnims = stepFadeAnims.map((anim, idx) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        delay: idx * 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    Animated.parallel(entranceAnims).start();
  }, []);

  // Step progression, audio effects, and circular bar fill sequence
  useEffect(() => {
    console.log('[AnalyzingScreen] 🎬 Screen mounted, initiating playScanningSound()');
    playScanningSound();

    let isCancelled = false;
    let initialAnim: Animated.CompositeAnimation | null = null;
    let isApiDone = false;
    let hasCompleted = false;

    const finishSequence = () => {
      if (hasCompleted || isCancelled) return;
      hasCompleted = true;
      console.log('[AnalyzingScreen] ✅ Both animation and AI analysis completed! Triggering celebration.');
      setTimeout(() => {
        playAnalysisCompleteSound();
        triggerCompleteJump();
      }, 400);
    };

    const completeProgressTo100 = () => {
      if (isCancelled || hasCompleted) return;
      if (initialAnim) {
        initialAnim.stop();
      }
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          finishSequence();
        }
      });
    };

    // Parallel Gemini analysis API call
    const runAnalysisApi = async () => {
      try {
        const report = getLatestSessionReport();
        const backendBaseUrl = getBackendBaseUrl();
        const activeSessionId =
          (params.sessionId as string) ||
          report?.id ||
          (report as any)?.sessionId ||
          report?.callParams?.sessionId ||
          '';

        console.log(`[AnalyzingScreen] 📡 Requesting session analysis from backend for session ${activeSessionId}...`);
        const res = await fetch(`${backendBaseUrl}/v1/sessions/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            turns: report?.sessionTurns || [],
            activeHints: report?.activeHints || [],
            topic: report?.topic || report?.levelTitle,
            scenarioId: (report as any)?.scenarioId || (report as any)?.callParams?.scenarioId || 'casual-chat',
            scenarioTitle: (report as any)?.scenarioTitle || (report as any)?.callParams?.scenarioTitle || report?.topic || 'Casual Chat',
            level: report?.callParams?.level,
          }),
        });

        const isIntro =
          (report as any)?.isIntroCall === true ||
          (report as any)?.callParams?.isIntroCall === 'true' ||
          (report as any)?.callParams?.isIntroCall === true ||
          params.isIntroCall === 'true';

        if (res.ok) {
          const data = await res.json();
          if (!isIntro && (data?.conversationSummary || data?.scenarioTitle)) {
            ActiveConversationStore.setActive({
              sessionId: activeSessionId,
              scenarioId: data.scenarioId || (report as any)?.scenarioId || 'casual-chat',
              scenarioTitle: data.scenarioTitle || (report as any)?.scenarioTitle || report?.topic || 'Casual Chat',
              topic: report?.topic || data.scenarioTitle || 'Everyday English',
              summary: data.conversationSummary,
              nextFollowup: data.nextFollowupTopic,
              lastPracticedAt: new Date().toISOString(),
              durationSeconds: report?.durationSeconds,
            });
          }
          if (data?.items && Array.isArray(data.items)) {
            const rawSupabaseUrl = data.userAudioUrl || '';
            const supabaseAudioUrl = rawSupabaseUrl.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
            const itemsWithAudio: FeedbackItem[] = data.items.map((item: any) => {
              const matchingTurn = report?.sessionTurns?.find((t) => t.turnIndex === item.userTurnIndex);
              const rawCandidate = item.userAudioUrl || supabaseAudioUrl || matchingTurn?.audioUrl || '';
              const candidate = rawCandidate.replace(/cl+fjfhdsjwkzgxwoolgp/g, 'clfjfhdsjwkzgxwoolgp');
              // Strictly avoid dead in-memory blob URLs (blob:http://...) which fail with net::ERR_FILE_NOT_FOUND
              const safeAudioUrl = candidate && !candidate.startsWith('blob:') ? candidate : '';
              return {
                ...item,
                userAudioUrl: safeAudioUrl,
              };
            });
            console.log(`[AnalyzingScreen] 🎯 Loaded ${itemsWithAudio.length} personalized feedback items (Supabase audio: ${supabaseAudioUrl})`);
            setLatestFeedbackItems(itemsWithAudio);
          }
        }
      } catch (err) {
        console.warn('[AnalyzingScreen] Session analysis API call failed (using fallback):', err);
      } finally {
        isApiDone = true;
        // Smoothly animate from the holding position to 100% and finish
        completeProgressTo100();
      }
    };

    runAnalysisApi();

    // Safety timeout: 45s fallback in case network completely drops or backend is unavailable
    const safetyTimer = setTimeout(() => {
      if (!isApiDone) {
        console.log('[AnalyzingScreen] ⏱️ 45s safety timeout reached, proceeding gracefully');
        isApiDone = true;
        completeProgressTo100();
      }
    }, 45000);

    let lastStep = 0;
    const listenerId = progressAnim.addListener(({ value }) => {
      let step = 0;
      if (value >= 0.96) step = 4;
      else if (value >= 0.72) step = 3;
      else if (value >= 0.48) step = 2;
      else if (value >= 0.24) step = 1;

      if (step !== lastStep) {
        console.log(`[AnalyzingScreen] 📍 Milestone crossed: step ${step} (progress: ${(value * 100).toFixed(0)}%)`);
        lastStep = step;
        setActiveStepIndex(step);

        // Spring pop the checkmark for the just-completed step one by one!
        if (step >= 1 && step <= 4) {
          const completedIdx = step - 1;
          checkPopAnims[completedIdx].setValue(0);
          Animated.spring(checkPopAnims[completedIdx], {
            toValue: 1,
            friction: 4.5,
            tension: 85,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
          playStepPop(completedIdx);
        }
      }
    });

    // Phase 1: Animate circular bar through steps 1-3 to ~88% over 5.2s, then hold at step 4 until API returns
    initialAnim = Animated.timing(progressAnim, {
      toValue: 0.88,
      duration: 5200,
      easing: Easing.bezier(0.2, 0.6, 0.3, 1),
      useNativeDriver: false,
    });

    initialAnim.start(({ finished }) => {
      if (finished && isApiDone) {
        completeProgressTo100();
      }
    });

    return () => {
      isCancelled = true;
      if (initialAnim) initialAnim.stop();
      clearTimeout(safetyTimer);
      progressAnim.removeListener(listenerId);
      stopScanningSound();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.container,
          isWebOrDesktop && styles.containerDesktop,
          { opacity: screenFadeAnim },
        ]}
      >

        {/* Top Graphic: Radar Sonar Circles + Blue Arc + Dancing Waves */}
        <View style={styles.graphicSection}>
          <Animated.View
            style={[
              styles.radarWrapper,
              {
                transform: [
                  { translateY: jumpTranslateYAnim },
                  { scale: Animated.multiply(radarPulseAnim, jumpScaleAnim) },
                ],
              },
            ]}
          >
            {/* SVG concentric circles and progress arc */}
            <Svg width={240} height={240} viewBox="0 0 240 240" style={styles.svgOverlay}>
              <Defs>
                <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#38BDF8" />
                  <Stop offset="100%" stopColor="#0284C7" />
                </LinearGradient>
              </Defs>

              {/* Outer soft ring */}
              <Circle
                cx="120"
                cy="120"
                r="105"
                stroke="#F0F9FF"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Middle soft ring with light cyan tint */}
              <Circle
                cx="120"
                cy="120"
                r="82"
                stroke="#E0F2FE"
                strokeWidth="18"
                fill="none"
                opacity={0.65}
              />

              {/* Background circular track */}
              <Circle
                cx="120"
                cy="120"
                r="98"
                stroke="#E0F2FE"
                strokeWidth="8"
                fill="none"
                opacity={0.65}
              />

              {/* Animated filling circular progress bar */}
              <AnimatedCircle
                cx="120"
                cy="120"
                r="98"
                stroke="url(#arcGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 120 120)"
              />

              {/* Orbiting accent dots */}
              <Circle cx="85" cy="40" r="4" fill="#38BDF8" opacity={0.8} />
              <Circle cx="40" cy="145" r="3.5" fill="#38BDF8" opacity={0.7} />
              <Circle cx="218" cy="120" r="4.5" fill="#0284C7" />
              <Circle cx="212" cy="182" r="4" fill="#38BDF8" opacity={0.8} />
            </Svg>

            {/* Center Circle with Dancing Audio Waves */}
            <View style={styles.centerPill}>
              <View style={styles.waveBarsRow}>
                <Animated.View style={[styles.waveBar, { height: 16, transform: [{ scaleY: wave1Anim }] }]} />
                <Animated.View style={[styles.waveBar, { height: 26, transform: [{ scaleY: wave2Anim }] }]} />
                <Animated.View style={[styles.waveBar, { height: 34, transform: [{ scaleY: wave3Anim }] }]} />
                <Animated.View style={[styles.waveBar, { height: 24, transform: [{ scaleY: wave4Anim }] }]} />
                <Animated.View style={[styles.waveBar, { height: 14, transform: [{ scaleY: wave5Anim }] }]} />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Text Section */}
        <View style={styles.textSection}>
          <Text style={[styles.mainTitle, isWebOrDesktop && styles.mainTitleDesktop]}>
            Analyzing your conversation...
          </Text>
          <Text style={[styles.subTitle, isWebOrDesktop && styles.subTitleDesktop]}>
            Maya is reviewing your speech and preparing personalized feedback.
          </Text>
        </View>

        {/* Checklist Steps (Image 1 Exact Layout) */}
        <View style={styles.stepsSection}>
          {ANALYSIS_STEPS.map((step, index) => {
            const isCompleted = activeStepIndex > index;
            const isCurrent = activeStepIndex === index;
            const isPending = activeStepIndex < index;

            return (
              <Animated.View
                key={step.id}
                style={[
                  styles.stepItem,
                  {
                    opacity: stepFadeAnims[index],
                    transform: [
                      {
                        translateY: stepFadeAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Step Icon Badge with lively spring pop when completed */}
                <Animated.View
                  style={[
                    styles.iconCircle,
                    (isCurrent || isCompleted) ? styles.iconCircleActive : styles.iconCirclePending,
                    isCompleted && {
                      transform: [
                        {
                          scale: checkPopAnims[index].interpolate({
                            inputRange: [0, 0.6, 1],
                            outputRange: [0.85, 1.15, 1.0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: checkPopAnims[index].interpolate({
                              inputRange: [0, 0.6, 1],
                              outputRange: [0.1, 1.35, 1.0],
                            }),
                          },
                        ],
                        opacity: checkPopAnims[index],
                      }}
                    >
                      <Ionicons name="checkmark" size={22} color="#0284C7" />
                    </Animated.View>
                  ) : step.iconType === 'material' ? (
                    <MaterialIcons
                      name={step.iconName as any}
                      size={20}
                      color={isCurrent ? '#0284C7' : '#94A3B8'}
                    />
                  ) : step.iconType === 'ionicons' ? (
                    <Ionicons
                      name={step.iconName as any}
                      size={20}
                      color={isCurrent ? '#0284C7' : '#94A3B8'}
                    />
                  ) : (
                    <Feather
                      name={step.iconName as any}
                      size={18}
                      color={isCurrent ? '#0284C7' : '#94A3B8'}
                    />
                  )}
                </Animated.View>

                {/* Step Text Info */}
                <View style={styles.stepTextWrapper}>
                  <Text
                    style={[
                      styles.stepTitle,
                      (isCurrent || isCompleted) && styles.stepTitleActive,
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDesktop: {
    maxWidth: 520,
  },
  /* Top Graphic Section */
  graphicSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 32,
    height: 240,
    width: 240,
  },
  radarWrapper: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerPill: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.12)',
      } as any,
      default: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
  },
  waveBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  /* Text Section */
  textSection: {
    alignItems: 'center',
    marginBottom: 36,
    paddingHorizontal: 12,
  },
  mainTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 23,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  mainTitleDesktop: {
    fontSize: 27,
  },
  subTitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    lineHeight: 22,
    color: '#64748B',
    textAlign: 'center',
  },
  subTitleDesktop: {
    fontSize: 15.5,
  },
  /* Steps List */
  stepsSection: {
    width: '100%',
    gap: 22,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: '#E0F2FE',
  },
  iconCirclePending: {
    backgroundColor: '#F1F5F9',
  },
  stepTextWrapper: {
    flex: 1,
  },
  stepTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15.5,
    color: '#334155',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  stepTitleActive: {
    color: '#0F172A',
  },
  stepSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
