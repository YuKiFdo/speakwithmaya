import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playStepPop, playOtherButtonSound } from '@/services/sound/sound-service';

export interface GuideStep {
  id: 'blue-glow' | 'purple-glow' | 'translation' | 'hint' | 'end-call';
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  targetPointer: string;
  position: 'top' | 'bottom';
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'blue-glow',
    title: 'Blue Glow = Maya is Speaking',
    description:
      'When this blue aura pulses around the screen, Maya is speaking. Listen carefully to her sentence!',
    icon: <Ionicons name="volume-high" size={16} color="#2563EB" />,
    badge: 'MAYA SPEAKING',
    badgeColor: '#2563EB',
    badgeBg: '#EFF6FF',
    targetPointer: '✦ Screen Edges',
    position: 'top',
  },
  {
    id: 'purple-glow',
    title: 'Purple Glow = Maya is Listening',
    description:
      'When the bottom glows purple, Maya is listening to your microphone in real time. Speak naturally!',
    icon: <Ionicons name="mic" size={16} color="#8B5CF6" />,
    badge: 'MAYA LISTENING',
    badgeColor: '#8B5CF6',
    badgeBg: '#F5F3FF',
    targetPointer: '⬇ Bottom Wave',
    position: 'top',
  },
  {
    id: 'translation',
    title: 'Sinhala Translation Pill',
    description:
      "Tap 'Show Translation' anytime below Maya's text to read what she said translated into everyday Sinhala.",
    icon: <MaterialIcons name="translate" size={16} color="#0D9488" />,
    badge: 'SINHALA HELP',
    badgeColor: '#0D9488',
    badgeBg: '#F0FDFA',
    targetPointer: '⬇ Below Subtitle',
    position: 'top',
  },
  {
    id: 'hint',
    title: 'Speaking Hints Lightbulb',
    description:
      'Stuck or not sure what to say? Tap the floating lightbulb in the bottom right for instant sentence suggestions!',
    icon: <Feather name="zap" size={16} color="#D97706" />,
    badge: 'HINTS & SUGGESTIONS',
    badgeColor: '#D97706',
    badgeBg: '#FFFBEB',
    targetPointer: '↘ Bottom Right',
    position: 'top',
  },
  {
    id: 'end-call',
    title: 'Ending Your Intro Call',
    description:
      'Locked for the first 60s until you chat with Maya. Once unlocked, tap once to conclude with a natural goodbye.',
    icon: <Feather name="phone-off" size={16} color="#E11D48" />,
    badge: '1-MIN MINIMUM CHAT',
    badgeColor: '#E11D48',
    badgeBg: '#FFF1F2',
    targetPointer: '↗ Top Right',
    position: 'bottom',
  },
];

interface ContextualCallGuideProps {
  visible: boolean;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onFinish: () => void;
  isDesktop?: boolean;
}

export function ContextualCallGuide({
  visible,
  currentStepIndex,
  onStepChange,
  onFinish,
  isDesktop = false,
}: ContextualCallGuideProps) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible]);

  // Subtle bounce & fade on step change
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(8);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [currentStepIndex]);

  if (!visible) return null;

  const currentStep = GUIDE_STEPS[currentStepIndex] || GUIDE_STEPS[0];
  const isLast = currentStepIndex === GUIDE_STEPS.length - 1;

  const handleNext = () => {
    try {
      playStepPop(currentStepIndex);
    } catch {}
    if (isLast) {
      onFinish();
    } else {
      onStepChange(currentStepIndex + 1);
    }
  };

  const handleSkip = () => {
    try {
      playOtherButtonSound();
    } catch {}
    onFinish();
  };

  // Smart vertical anchoring based on active step target
  const isTopPosition = currentStep.position === 'top';
  const verticalStyle = isTopPosition
    ? { top: insets.top + (isDesktop ? 86 : 76) }
    : { bottom: insets.bottom + (isDesktop ? 28 : 20) };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        isDesktop ? styles.containerDesktop : styles.containerMobile,
        verticalStyle,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: isTopPosition
                ? slideAnim.interpolate({
                    inputRange: [0, 8],
                    outputRange: [0, -8],
                  })
                : slideAnim,
            },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.cardInner}>
          {/* Header Row: Badge, Direction Pointer & Close */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: currentStep.badgeBg },
                ]}
              >
                {currentStep.icon}
                <Text
                  style={[styles.badgeText, { color: currentStep.badgeColor }]}
                >
                  {currentStep.badge}
                </Text>
              </View>

              {/* Target Pointer Chip */}
              <View style={styles.pointerChip}>
                <Text style={styles.pointerText}>
                  {currentStep.targetPointer}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSkip}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip intro guide"
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.description}>{currentStep.description}</Text>

          {/* Footer Row: Step Dots & Next Button */}
          <View style={styles.footerRow}>
            {/* Step Indicators */}
            <View style={styles.dotsRow}>
              {GUIDE_STEPS.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                return (
                  <Pressable
                    key={step.id}
                    onPress={() => onStepChange(idx)}
                    hitSlop={8}
                    style={[
                      styles.dot,
                      isActive && [
                        styles.dotActive,
                        { backgroundColor: currentStep.badgeColor },
                      ],
                      isPassed && styles.dotPassed,
                    ]}
                  />
                );
              })}
              <Text style={styles.stepCounterText}>
                {currentStepIndex + 1} of {GUIDE_STEPS.length}
              </Text>
            </View>

            {/* Next / Got it Button */}
            <Pressable
              style={({ pressed }) => [
                styles.nextButton,
                { backgroundColor: currentStep.badgeColor },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Got it' : 'Next tip'}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? 'Got it!' : 'Next'}
              </Text>
              {!isLast && (
                <Feather name="arrow-right" size={14} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  containerMobile: {
    paddingHorizontal: 16,
  },
  containerDesktop: {
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    ...Platform.select({
      web: {
        boxShadow:
          '0 16px 36px -6px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  cardInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  badgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  pointerChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pointerText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 10.5,
    color: '#64748B',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: '#E2E8F0',
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15.5,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 18.5,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 14,
    borderRadius: 3,
  },
  dotPassed: {
    backgroundColor: '#94A3B8',
  },
  stepCounterText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11.5,
    color: '#94A3B8',
    marginLeft: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 3px 8px rgba(0, 0, 0, 0.12)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
        elevation: 2,
      },
    }),
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#FFFFFF',
  },
});
