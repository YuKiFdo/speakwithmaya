import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  playScanningSound,
  stopScanningSound,
  playStepPop,
  playAnalysisCompleteSound,
} from '@/services/sound/sound-service';
import { authService } from '@/services/auth/auth-service';

// Enable smooth LayoutAnimation on Android for pagination dot morphing
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Strip out React Native Web's synthetic collapsable attribute before passing to SVG circle on Web only
const BaseCircle =
  Platform.OS === 'web'
    ? React.forwardRef<any, any>(({ collapsable, ...props }, ref) => (
        <Circle ref={ref} {...props} />
      ))
    : Circle;

if (Platform.OS === 'web') {
  (BaseCircle as any).displayName = 'WebSafeCircle';
}

const AnimatedCircle = Animated.createAnimatedComponent(BaseCircle);

// Checklist steps matching design
const CHECKLIST_ITEMS = [
  { label: 'Understanding your goals...', triggerAt: 0.22 },
  { label: 'Personalizing your practice...', triggerAt: 0.58 },
  { label: 'Getting Maya ready for you...', triggerAt: 0.88 },
];

// Rotating testimonials
const TESTIMONIALS = [
  {
    quote:
      '"I finally started speaking without translating in my head. Maya corrects me instantly."',
    author: 'Dilini R. · Colombo',
  },
  {
    quote:
      '"Speaking with Maya feels like chatting with a real friend. My confidence went way up!"',
    author: 'Kaveen P. · Kandy',
  },
  {
    quote:
      '"Just 10 minutes a day made a massive difference before my job interview."',
    author: 'Sanduni M. · Gampaha',
  },
];

// Circle dimensions
const CIRCLE_SIZE = 144;
const STROKE_WIDTH = 9;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const DOT_LAYOUT_ANIM = LayoutAnimation.create(
  220,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

// Isolated counter component: only the percentage number re-renders on ticks
const PercentageCounter = React.memo(function PercentageCounter({
  anim,
}: {
  anim: Animated.Value;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let last = -1;
    const id = anim.addListener(({ value }) => {
      const p = Math.min(100, Math.max(0, Math.round(value * 100)));
      if (p !== last) {
        last = p;
        setPercent(p);
      }
    });
    return () => {
      anim.removeListener(id);
    };
  }, [anim]);

  return <Text style={styles.percentText}>{percent}%</Text>;
});

// Animated Checklist Row with spring check-pop & active step pulse
const ChecklistItemRow = React.memo(function ChecklistItemRow({
  label,
  isChecked,
  isCurrent,
  index,
}: {
  label: string;
  isChecked: boolean;
  isCurrent: boolean;
  index: number;
}) {
  const useNative = Platform.OS !== 'web';
  const rowEntranceAnim = useRef(new Animated.Value(0)).current;
  const checkPopAnim = useRef(new Animated.Value(0)).current;
  const activePulseAnim = useRef(new Animated.Value(1)).current;

  // Staggered entrance on mount
  useEffect(() => {
    Animated.timing(rowEntranceAnim, {
      toValue: 1,
      duration: 360,
      delay: 140 + index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    }).start();
  }, [index, rowEntranceAnim, useNative]);

  // Subtle pulse while this item is the active step being processed
  useEffect(() => {
    if (isCurrent && !isChecked) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(activePulseAnim, {
            toValue: 0.55,
            duration: 550,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(activePulseAnim, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      activePulseAnim.setValue(1);
    }
  }, [isCurrent, isChecked, activePulseAnim, useNative]);

  // Crisp spring pop when checked
  useEffect(() => {
    if (isChecked) {
      Animated.spring(checkPopAnim, {
        toValue: 1,
        tension: 110,
        friction: 6,
        useNativeDriver: useNative,
      }).start();
    }
  }, [isChecked, checkPopAnim, useNative]);

  const circleScale = isChecked
    ? checkPopAnim.interpolate({
        inputRange: [0, 0.6, 1],
        outputRange: [0.75, 1.16, 1],
      })
    : 1;

  const checkMarkScale = checkPopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const labelTranslateX = checkPopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });

  return (
    <Animated.View
      style={[
        styles.checklistRow,
        {
          opacity: rowEntranceAnim,
          transform: [
            {
              translateY: rowEntranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.checkCircle,
          isChecked ? styles.checkCircleActive : styles.checkCirclePending,
          {
            opacity: isChecked ? 1 : activePulseAnim,
            transform: [{ scale: circleScale }],
          },
        ]}
      >
        {isChecked && (
          <Animated.Text
            style={[
              styles.checkMark,
              {
                opacity: checkPopAnim,
                transform: [{ scale: checkMarkScale }],
              },
            ]}
          >
            ✓
          </Animated.Text>
        )}
      </Animated.View>

      <Animated.Text
        style={[
          styles.checkLabel,
          isChecked ? styles.checkLabelActive : styles.checkLabelPending,
          {
            opacity: isChecked ? 1 : activePulseAnim,
            transform: [{ translateX: labelTranslateX }],
          },
        ]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
});

export default function BuildingPlanScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    userName?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
    languageMode?: string;
    dailyGoal?: string;
    isIntroCall?: string;
    sessionId?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const useNative = Platform.OS !== 'web';

  const progressAnim = useRef(new Animated.Value(0)).current;
  const screenEntranceAnim = useRef(new Animated.Value(0)).current;
  const circleCompleteScaleAnim = useRef(new Animated.Value(1)).current;
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stored in ref so it is created once, not on every tick
  const strokeDashoffset = useRef(
    progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [CIRCUMFERENCE, 0],
    })
  ).current;

  const [checkedCount, setCheckedCount] = useState(0);
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);

  // Testimonial card transition animations (fade, slide & subtle scale)
  const cardOpacityAnim = useRef(new Animated.Value(1)).current;
  const cardTranslateAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    authService.syncStep('/onboarding/building-plan');

    // 1. Start gentle ambient processing whoosh sound
    try {
      playScanningSound();
    } catch {}

    // 2. Smooth initial screen entrance
    Animated.timing(screenEntranceAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    }).start();

    let lastCount = 0;

    const listenerId = progressAnim.addListener(({ value }) => {
      // Update checklist ONLY when a threshold is crossed
      let count = 0;
      for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
        if (value >= CHECKLIST_ITEMS[i].triggerAt) count = i + 1;
      }
      if (count !== lastCount) {
        lastCount = count;
        setCheckedCount(count);
        // Play gamified pop sound on step milestone
        try {
          playStepPop(count - 1);
        } catch {}
      }
    });

    // 3. Realistic multi-stage progress curve (~3.7s total)
    const progressSequence = Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 0.28,
        duration: 850,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.64,
        duration: 1150,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.92,
        duration: 1050,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    progressSequence.start(({ finished }) => {
      if (!finished) return;

      // Stop background scanning sound and play completion chime
      try {
        stopScanningSound();
        playAnalysisCompleteSound();
      } catch {}

      // Subtle celebratory pulse on the 100% progress ring
      Animated.sequence([
        Animated.timing(circleCompleteScaleAnim, {
          toValue: 1.06,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.spring(circleCompleteScaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 6,
          useNativeDriver: useNative,
        }),
      ]).start();

      // Transition to Special One-Time Offer (Spin Wheel) Screen
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace('/onboarding/special-offer' as any);
      }, 550);
    });

    // 4. Cycle testimonials with silky slide, fade & scale animation
    const testimonialTimer = setInterval(() => {
      Animated.parallel([
        Animated.timing(cardOpacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.timing(cardTranslateAnim, {
          toValue: -10,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.timing(cardScaleAnim, {
          toValue: 0.98,
          duration: 200,
          useNativeDriver: useNative,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;

        LayoutAnimation.configureNext(DOT_LAYOUT_ANIM);
        setActiveTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);

        cardTranslateAnim.setValue(10);
        cardScaleAnim.setValue(0.98);

        Animated.parallel([
          Animated.timing(cardOpacityAnim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: useNative,
          }),
          Animated.spring(cardTranslateAnim, {
            toValue: 0,
            tension: 80,
            friction: 9,
            useNativeDriver: useNative,
          }),
          Animated.spring(cardScaleAnim, {
            toValue: 1,
            tension: 80,
            friction: 9,
            useNativeDriver: useNative,
          }),
        ]).start();
      });
    }, 2400);

    return () => {
      progressSequence.stop();
      progressAnim.removeListener(listenerId);
      clearInterval(testimonialTimer);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      try {
        stopScanningSound();
      } catch {}
    };
  }, []);

  const activeTestimonial = TESTIMONIALS[activeTestimonialIdx];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isPhone && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          style={[
            styles.mainContainer,
            {
              opacity: screenEntranceAnim,
              transform: [
                {
                  translateY: screenEntranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Top Circular Progress */}
          <Animated.View
            style={[
              styles.circleContainer,
              { transform: [{ scale: circleCompleteScaleAnim }] },
            ]}
          >
            <Svg
              width={CIRCLE_SIZE}
              height={CIRCLE_SIZE}
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
            >
              {/* Background track circle */}
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke="#EEF2F6"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Animated progress arc */}
              <AnimatedCircle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke="#3B5BF6"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
              />
            </Svg>
            {/* Centered percentage number */}
            <View style={styles.percentOverlay}>
              <PercentageCounter anim={progressAnim} />
            </View>
          </Animated.View>

          {/* Heading */}
          <Text style={styles.title}>Building Your Plan</Text>
          <Text style={styles.subtitle}>
            Personalizing your learning experience...
          </Text>

          {/* Checklist */}
          <View style={styles.checklist}>
            {CHECKLIST_ITEMS.map((item, index) => (
              <ChecklistItemRow
                key={item.label}
                index={index}
                label={item.label}
                isChecked={index < checkedCount}
                isCurrent={index === checkedCount}
              />
            ))}
          </View>

          {/* Testimonial Card with Animated Transitions */}
          <Animated.View
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
            style={[
              styles.testimonialCard,
              {
                opacity: cardOpacityAnim,
                transform: [
                  { translateY: cardTranslateAnim },
                  { scale: cardScaleAnim },
                ],
              },
            ]}
          >
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Text key={i} style={styles.starIcon}>
                  ★
                </Text>
              ))}
            </View>
            <Text style={styles.quoteText}>{activeTestimonial.quote}</Text>
            <Text style={styles.authorText}>{activeTestimonial.author}</Text>
          </Animated.View>

          {/* Pagination Dots */}
          <View style={styles.dotsRow}>
            {TESTIMONIALS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeTestimonialIdx
                    ? styles.dotActive
                    : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  scrollContentDesktop: {
    paddingVertical: 56,
  },
  mainContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  percentOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 38,
    color: '#3B5BF6',
    letterSpacing: -0.8,
    ...fontStyle('outfit', 'extraBold'),
  },
  title: {
    fontSize: 26,
    color: '#10213D',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 8,
    ...fontStyle('inter', 'extraBold'),
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
    ...fontStyle('inter', 'regular'),
  },
  checklist: {
    width: '100%',
    paddingHorizontal: 12,
    gap: 18,
    marginBottom: 44,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#3B5BF6',
  },
  checkCirclePending: {
    backgroundColor: '#F1F5F9',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
  },
  checkLabel: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  checkLabelActive: {
    color: '#10213D',
    ...fontStyle('inter', 'semiBold'),
  },
  checkLabelPending: {
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
  testimonialCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 22,
    paddingVertical: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
        willChange: 'transform, opacity',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
    }),
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  starIcon: {
    fontSize: 16,
    color: '#F59E0B',
  },
  quoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
    marginBottom: 14,
    ...fontStyle('inter', 'medium'),
  },
  authorText: {
    fontSize: 13,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#3B5BF6',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
});