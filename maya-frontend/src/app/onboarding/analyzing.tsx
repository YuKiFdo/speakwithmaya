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

export default function AnalyzingScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Active step index (0, 1, 2, 3, 4=done)
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Animations for center wave bars
  const wave1Anim = useRef(new Animated.Value(0.4)).current;
  const wave2Anim = useRef(new Animated.Value(0.85)).current;
  const wave3Anim = useRef(new Animated.Value(1.0)).current;
  const wave4Anim = useRef(new Animated.Value(0.7)).current;
  const wave5Anim = useRef(new Animated.Value(0.35)).current;

  // Pulse animation for outer concentric radar rings
  const radarPulseAnim = useRef(new Animated.Value(1)).current;
  const radarRotateAnim = useRef(new Animated.Value(0)).current;

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

  // Step progression sequence: advance through steps over ~3.4s then navigate to complete screen
  useEffect(() => {
    const t1 = setTimeout(() => setActiveStepIndex(1), 850);
    const t2 = setTimeout(() => setActiveStepIndex(2), 1700);
    const t3 = setTimeout(() => setActiveStepIndex(3), 2550);
    const t4 = setTimeout(() => setActiveStepIndex(4), 3300);

    const tNavigate = setTimeout(() => {
      router.replace({
        pathname: '/onboarding/complete',
        params: params as any,
      });
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tNavigate);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isWebOrDesktop && styles.containerDesktop]}>

        {/* Top Graphic: Radar Sonar Circles + Blue Arc + Dancing Waves */}
        <View style={styles.graphicSection}>
          <Animated.View
            style={[
              styles.radarWrapper,
              { transform: [{ scale: radarPulseAnim }] },
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

              {/* Accent top-right quarter arc (exact match to Image) */}
              <Path
                d="M 120 22 A 98 98 0 0 1 218 120"
                stroke="url(#arcGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
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
              <View key={step.id} style={styles.stepItem}>
                {/* Step Icon Badge */}
                <View
                  style={[
                    styles.iconCircle,
                    (isCurrent || isCompleted) ? styles.iconCircleActive : styles.iconCirclePending,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={20} color="#0284C7" />
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
                </View>

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
              </View>
            );
          })}
        </View>

      </View>
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
