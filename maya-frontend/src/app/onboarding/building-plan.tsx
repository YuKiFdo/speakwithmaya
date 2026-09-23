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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  const [displayPercent, setDisplayPercent] = useState(0);
  const [statusText, setStatusText] = useState(STATUS_MESSAGES[0].text);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    CHECKLIST_ITEMS.map(() => false),
  );

  // Animated stroke dash offset
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  useEffect(() => {
    // Listener to update display percent, status text, and checklist
    const listenerId = progressAnim.addListener(({ value }) => {
      const pct = Math.round(value * 100);
      setDisplayPercent(pct);

      // Update status message
      let currentMessage = STATUS_MESSAGES[0].text;
      for (const msg of STATUS_MESSAGES) {
        if (value >= msg.at) currentMessage = msg.text;
      }
      setStatusText(currentMessage);

      // Check off items
      setCheckedItems(CHECKLIST_ITEMS.map((item) => value >= item.triggerAt));
    });

    // Run the progress animation (~3 seconds)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false, // We need JS-driven for the listener
    }).start(() => {
      // Navigate to next screen after a brief pause
      setTimeout(() => {
        router.replace({
          pathname: '/onboarding/intro-call',
          params,
        });
      }, 600);
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
          {/* Percentage text overlaid */}
          <View style={styles.percentOverlay}>
            <Text style={styles.percentText}>{displayPercent}%</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Building Your Plan</Text>
        <Text style={styles.subtitle}>{statusText}</Text>

        {/* Checklist */}
        <View style={styles.checklist}>
          {CHECKLIST_ITEMS.map((item, index) => {
            const isChecked = checkedItems[index];
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
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Outfit, sans-serif' }
      : { fontFamily: 'Outfit_800ExtraBold' }),
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, sans-serif' }
      : { fontFamily: 'Inter_400Regular' }),
  },
  checklist: {
    width: '100%',
    gap: 18,
    paddingHorizontal: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8ecf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#0085db',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  checkLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, sans-serif' }
      : { fontFamily: 'Inter_600SemiBold' }),
  },
  checkLabelInactive: {
    color: '#cbd5e1',
    fontWeight: '400',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, sans-serif' }
      : { fontFamily: 'Inter_400Regular' }),
  },
});
