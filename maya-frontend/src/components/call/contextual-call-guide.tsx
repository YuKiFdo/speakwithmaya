import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  playStepPop,
  playOtherButtonSound,
} from '@/services/sound/sound-service';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    title: 'When Maya is speaking',
    description:
      'A soft blue glow appears around the screen while Maya talks. Just listen naturally.',
    icon: <Ionicons name="volume-high" size={18} color="#2563EB" />,
    badge: 'Tip 1 of 5',
    badgeColor: '#2563EB',
    badgeBg: '#EFF6FF',
    targetPointer: 'Screen edges',
    position: 'top',
  },
  {
    id: 'purple-glow',
    title: 'Your turn to speak',
    description:
      'When the bottom wave turns purple, your mic is live. Reply in your own words!',
    icon: <Ionicons name="mic" size={18} color="#7C3AED" />,
    badge: 'Tip 2 of 5',
    badgeColor: '#7C3AED',
    badgeBg: '#F5F3FF',
    targetPointer: 'Bottom wave',
    position: 'top',
  },
  {
    id: 'translation',
    title: 'Need Sinhala help?',
    description:
      'Tap "Show Translation" under Maya’s message anytime to see what she meant in Sinhala.',
    icon: <MaterialIcons name="translate" size={18} color="#0D9488" />,
    badge: 'Tip 3 of 5',
    badgeColor: '#0D9488',
    badgeBg: '#F0FDFA',
    targetPointer: 'Below subtitle',
    position: 'top',
  },
  {
    id: 'hint',
    title: 'Not sure what to say?',
    description:
      'Tap the lightbulb in the bottom-right corner for instant reply ideas you can read aloud.',
    icon: <Feather name="zap" size={18} color="#D97706" />,
    badge: 'Tip 4 of 5',
    badgeColor: '#D97706',
    badgeBg: '#FFFBEB',
    targetPointer: 'Bottom right',
    position: 'top',
  },
  {
    id: 'end-call',
    title: 'Finishing your call',
    description:
      'After 1 minute of practice, the red button at the top-right unlocks so you can wrap up anytime.',
    icon: <Feather name="phone-off" size={17} color="#E11D48" />,
    badge: 'Tip 5 of 5',
    badgeColor: '#E11D48',
    badgeBg: '#FFF1F2',
    targetPointer: 'Top right',
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

const DOT_LAYOUT_ANIM = LayoutAnimation.create(
  200,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

export function ContextualCallGuide({
  visible,
  currentStepIndex,
  onStepChange,
  onFinish,
  isDesktop = false,
}: ContextualCallGuideProps) {
  const insets = useSafeAreaInsets();
  const useNative = Platform.OS !== 'web';

  // Card entrance animation
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  // Inner step content transition
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentSlideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 75,
          friction: 8,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: useNative,
      }).start();
    }
  }, [visible, cardOpacity, cardScale, useNative]);

  // Smooth horizontal glide when switching steps
  useEffect(() => {
    if (!visible) return;
    LayoutAnimation.configureNext(DOT_LAYOUT_ANIM);

    contentOpacity.setValue(0);
    contentSlideX.setValue(10);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      Animated.spring(contentSlideX, {
        toValue: 0,
        tension: 90,
        friction: 9,
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [currentStepIndex, visible, contentOpacity, contentSlideX, useNative]);

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

  const isTopPosition = currentStep.position === 'top';
  const verticalStyle = isTopPosition
    ? { top: insets.top + (isDesktop ? 84 : 74) }
    : { bottom: insets.bottom + (isDesktop ? 28 : 20) };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        isDesktop ? styles.containerDesktop : styles.containerMobile,
        verticalStyle,
        {
          opacity: cardOpacity,
          transform: [{ scale: cardScale }],
        },
      ]}
    >
      <View style={styles.card}>
        {/* Main Content Row */}
        <Animated.View
          style={[
            styles.bodyRow,
            {
              opacity: contentOpacity,
              transform: [{ translateX: contentSlideX }],
            },
          ]}
        >
          {/* Soft Icon Circle */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: currentStep.badgeBg },
            ]}
          >
            {currentStep.icon}
          </View>

          {/* Natural Copy */}
          <View style={styles.textColumn}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{currentStep.title}</Text>
              <Pressable
                onPress={handleSkip}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Dismiss guide"
              >
                <Feather name="x" size={15} color="#94A3B8" />
              </Pressable>
            </View>

            <Text style={styles.description}>{currentStep.description}</Text>
          </View>
        </Animated.View>

        {/* Clean Minimal Footer */}
        <View style={styles.footerRow}>
          {/* Minimal Pill Dots */}
          <View style={styles.dotsContainer}>
            {GUIDE_STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <Pressable
                  key={step.id}
                  onPress={() => onStepChange(idx)}
                  hitSlop={8}
                  style={[styles.dot, isActive && styles.dotActive]}
                />
              );
            })}
          </View>

          <View style={styles.actionsRight}>
            {!isLast && (
              <Pressable
                onPress={handleSkip}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.nextButton,
                pressed && styles.nextButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Start speaking' : 'Next tip'}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? 'Got it' : 'Next'}
              </Text>
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
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.12)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 8,
      },
    }),
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  title: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
    paddingRight: 8,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
  },
  closeBtnPressed: {
    backgroundColor: '#F1F5F9',
  },
  description: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 18.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#2563EB',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  skipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#94A3B8',
  },
  nextButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 15,
    paddingVertical: 6.5,
    borderRadius: 999,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  nextButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#FFFFFF',
  },
});