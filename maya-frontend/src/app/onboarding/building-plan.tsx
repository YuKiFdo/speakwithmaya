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
import Svg, { Circle } from 'react-native-svg';

// Strip out React Native Web's synthetic collapsable attribute before passing to SVG circle on Web only
const BaseCircle = Platform.OS === 'web'
  ? React.forwardRef<any, any>(({ collapsable, ...props }, ref) => <Circle ref={ref} {...props} />)
  : Circle;

if (Platform.OS === 'web') {
  (BaseCircle as any).displayName = 'WebSafeCircle';
}

const AnimatedCircle = Animated.createAnimatedComponent(BaseCircle);

// Checklist steps with their trigger thresholds
const CHECKLIST_ITEMS = [
  { label: 'Goal locked in', triggerAt: 0.2 },
  { label: 'Level assessed', triggerAt: 0.5 },
  { label: 'Daily schedule set', triggerAt: 0.85 },
];

// Status messages that rotate as progress increases
const STATUS_MESSAGES = [
  { at: 0, text: 'Analyzing your goals...' },
  { at: 0.2, text: 'Matching your level...' },
  { at: 0.5, text: 'Setting your schedule...' },
  { at: 0.85, text: 'Finalizing your plan...' },
];

// Circle dimensions
const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 8;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Isolated counter component: only the percentage number re-renders on ticks,
// leaving the parent screen, SVG tree, and checklist completely calm at 60 FPS
const PercentageCounter = React.memo(function PercentageCounter({
  anim,
}: {
  anim: Animated.Value;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let last = -1;
    const id = anim.addListener(({ value }) => {
      const p = Math.round(value * 100);
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

export default function BuildingPlanScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
    dailyGoal?: string;
  }>();

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Stored in ref so it is created once, not 100 times during ticks
  const strokeDashoffset = useRef(
    progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [CIRCUMFERENCE, 0],
    }),
  ).current;

  const [statusText, setStatusText] = useState(STATUS_MESSAGES[0].text);
  const [checkedCount, setCheckedCount] = useState(0);

  useEffect(() => {
    let lastMsg = STATUS_MESSAGES[0].text;
    let lastCount = 0;

    const listenerId = progressAnim.addListener(({ value }) => {
      // 1. Update status message ONLY when milestone is crossed (4 times total)
      let currentMsg = STATUS_MESSAGES[0].text;
      for (const msg of STATUS_MESSAGES) {
        if (value >= msg.at) currentMsg = msg.text;
      }
      if (currentMsg !== lastMsg) {
        lastMsg = currentMsg;
        setStatusText(currentMsg);
      }

      // 2. Update checklist ONLY when a threshold is crossed (3 times total)
      let count = 0;
      for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
        if (value >= CHECKLIST_ITEMS[i].triggerAt) count = i + 1;
      }
      if (count !== lastCount) {
        lastCount = count;
        setCheckedCount(count);
      }
    });

    // Run the progress animation (~3.2 seconds) with smooth cubic ease-out
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setTimeout(() => {
        router.replace({
          pathname: '/onboarding/intro-call',
          params,
        });
      }, 500);
    });

    return () => {
      progressAnim.removeListener(listenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Circular Progress */}
        <View style={styles.circleContainer}>
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
              stroke="#e8ecf0"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Animated progress arc */}
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="#0085db"
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          {/* Isolated percentage counter */}
          <View style={styles.percentOverlay}>
            <PercentageCounter anim={progressAnim} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Building Your Plan</Text>
        <Text style={styles.subtitle}>{statusText}</Text>

        {/* Checklist */}
        <View style={styles.checklist}>
          {CHECKLIST_ITEMS.map((item, index) => {
            const isChecked = index < checkedCount;
            return (
              <View key={item.label} style={styles.checklistRow}>
                <View
                  style={[
                    styles.checkCircle,
                    isChecked && styles.checkCircleActive,
                  ]}
                >
                  {isChecked && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    !isChecked && styles.checkLabelInactive,
                  ]}
                >
                  {item.label}
                </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 32,
    alignItems: 'center',
    alignSelf: 'center',
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  percentOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0085db',
    letterSpacing: -0.5,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Outfit, sans-serif' }
      : { fontFamily: 'Outfit_700Bold' }),
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 6,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Outfit, sans-serif' }
      : { fontFamily: 'Outfit_800ExtraBold' }),
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 36,
    height: 22,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, sans-serif' }
      : { fontFamily: 'Inter_400Regular' }),
  },
  checklist: {
    width: '100%',
    gap: 16,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#0085db',
    borderColor: '#0085db',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  checkLabel: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, sans-serif' }
      : { fontFamily: 'Inter_500Medium' }),
  },
  checkLabelInactive: {
    color: '#94a3b8',
  },
});
