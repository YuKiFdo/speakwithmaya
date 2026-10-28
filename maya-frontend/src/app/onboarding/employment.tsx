import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Ionicons } from '@expo/vector-icons';
import {
  playMayaEmploymentPromptVoice,
  stopMayaEmploymentPromptVoice,
  playMayaEmploymentFeedbackVoice,
  stopMayaEmploymentFeedbackVoice,
  preloadEmploymentVoices,
  playUnderstoodTapSound,
} from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

interface EmploymentOption {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
}

const EMPLOYMENT_OPTIONS: EmploymentOption[] = [
  {
    id: 'full-time',
    icon: '💼',
    iconBg: '#EFF6FF',
    title: 'Working full-time',
    subtitle: 'I have a full-time job',
  },
  {
    id: 'part-time',
    icon: '💻',
    iconBg: '#F1F5F9',
    title: 'Working part-time',
    subtitle: 'I have a part-time job',
  },
  {
    id: 'student',
    icon: '🎓',
    iconBg: '#FEF9C3',
    title: 'Student',
    subtitle: 'I am currently studying',
  },
  {
    id: 'looking-for-job',
    icon: '🔍',
    iconBg: '#ECFDF5',
    title: 'Looking for a job',
    subtitle: 'I am currently unemployed',
  },
  {
    id: 'other',
    icon: '🏡',
    iconBg: '#FEE2E2',
    title: 'Other',
    subtitle: 'Housewife, freelancer, etc.',
  },
];

export default function EmploymentScreen() {
  const { isTablet, isDesktop } = useBreakpoint();
  const [selectedEmployment, setSelectedEmployment] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    EMPLOYMENT_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(18),
      scale: new Animated.Value(1),
    })),
  ).current;

  // Staggered cascade entrance on mount + prompt audio
  useEffect(() => {
    // 0. Preload employment voices
    preloadEmploymentVoices();

    // 1. Header fades & slides in
    Animated.parallel([
      Animated.timing(headerOpacityAnim, {
        toValue: 1,
        duration: 380,
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

    // 2. Play Maya's friendly question prompt ("What is your current employment status? This helps us personalise your practice sessions!")
    const promptTimer = setTimeout(() => {
      playMayaEmploymentPromptVoice();
    }, 200);

    // 3. Cascade cards in sequence
    EMPLOYMENT_OPTIONS.forEach((_, idx) => {
      const delay = 350 + idx * 80;
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(cardAnims[idx].opacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(cardAnims[idx].slide, {
            toValue: 0,
            friction: 7,
            tension: 45,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }, delay);
    });

    return () => {
      clearTimeout(promptTimer);
      stopMayaEmploymentPromptVoice();
      stopMayaEmploymentFeedbackVoice();
    };
  }, []);

  const handleSelectEmployment = (item: EmploymentOption, index: number) => {
    if (isTransitioning) return;

    // Immediately stop prompt voice
    stopMayaEmploymentPromptVoice();

    setSelectedEmployment(item.id);
    setIsTransitioning(true);

    // Tactile pop animation on tapped card
    Animated.sequence([
      Animated.timing(cardAnims[index].scale, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(cardAnims[index].scale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Play tactile select chime
    playUnderstoodTapSound();

    let hasNavigated = false;
    const navigateNext = () => {
      if (!hasNavigated) {
        hasNavigated = true;
        stopMayaEmploymentFeedbackVoice();
        OnboardingStore.updateField('employment', item.id);
        authService.syncStep('/onboarding/daily-goal');
        router.replace('/onboarding/daily-goal' as any);
      }
    };

    // Maya speaks personalized encouraging sentence, waits until finish, then transitions to next screen
    playMayaEmploymentFeedbackVoice(item.id, {
      onEnd: () => {
        // Natural breath pause after she finishes speaking her full sentence
        setTimeout(navigateNext, 250);
      },
      onError: () => {
        setTimeout(navigateNext, 500);
      },
    });

    // Extreme fallback: only in case browser audio engine stalls completely without firing events
    setTimeout(navigateNext, 10000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, (isTablet || isDesktop) && styles.desktopContainer]}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.8} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerOpacityAnim,
                transform: [{ translateY: headerSlideAnim }],
              },
            ]}
          >
            <Text style={styles.title}>What is your current employment status?</Text>
            <Text style={styles.subtitle}>This helps us personalise your learning experience.</Text>
          </Animated.View>

          {/* Options List with Staggered Entrance */}
          <View style={styles.optionsList}>
            {EMPLOYMENT_OPTIONS.map((item, index) => {
              const isSelected = selectedEmployment === item.id;
              const anim = cardAnims[index];

              return (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: anim.opacity,
                    transform: [
                      { translateY: anim.slide },
                      { scale: anim.scale },
                    ],
                  }}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.card,
                      isSelected && styles.cardSelected,
                      pressed && !isSelected && styles.cardPressed,
                    ]}
                    onPress={() => handleSelectEmployment(item, index)}
                    android_ripple={{ color: '#E2E8F0', borderless: false }}
                  >
                    <View style={styles.cardContent}>
                      {/* Left Icon Container Pill */}
                      <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
                        <Text style={styles.cardEmoji}>{item.icon}</Text>
                      </View>

                      {/* Text Column */}
                      <View style={styles.textContainer}>
                        <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>

                    {/* Brand Blue Checkmark Indicator when selected */}
                    {isSelected && (
                      <View style={styles.checkmarkWrapper}>
                        <Ionicons name="checkmark-circle" size={24} color="#0D4EFD" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
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
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 20 : 12,
    paddingBottom: 24,
    alignSelf: 'center',
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  progressContainer: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 28,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 30,
    lineHeight: 38,
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15.5,
    lineHeight: 22,
    color: '#64748B',
    marginTop: 8,
  },
  optionsList: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  cardSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(13, 78, 253, 0.16)',
      } as any,
      default: {
        shadowColor: '#0D4EFD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 3,
      },
    }),
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: '#F8FAFC',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardEmoji: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17.5,
    lineHeight: 23,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardTitleSelected: {
    color: '#0D4EFD',
  },
  cardSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    lineHeight: 18,
    color: '#64748B',
  },
  checkmarkWrapper: {
    marginLeft: 12,
  },
});
