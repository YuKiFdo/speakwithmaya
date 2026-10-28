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
  playMayaDailyGoalPromptVoice,
  stopMayaDailyGoalPromptVoice,
  playMayaDailyGoalFeedbackVoice,
  stopMayaDailyGoalFeedbackVoice,
  preloadDailyGoalVoices,
  playUnderstoodTapSound,
} from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

interface PracticeOption {
  id: string;
  badge?: string;
  title: string;
  subtitle: string;
}

const PRACTICE_OPTIONS: PracticeOption[] = [
  {
    id: '5-min',
    title: '5 min',
    subtitle: 'Quick daily practice',
  },
  {
    id: '10-min',
    title: '10 min',
    subtitle: 'For steady growth',
  },
  {
    id: '15-min',
    title: '15 min',
    subtitle: 'Build confidence faster',
  },
  {
    id: '30-min',
    title: '30 min',
    subtitle: 'For faster improvement',
  },
];

export default function DailyGoalScreen() {
  const { isTablet, isDesktop } = useBreakpoint();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    PRACTICE_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(18),
      scale: new Animated.Value(1),
    })),
  ).current;

  // Staggered cascade entrance on mount + prompt audio
  useEffect(() => {
    // 0. Preload daily goal voices
    preloadDailyGoalVoices();

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

    // 2. Play Maya's motivating question prompt ("How much can you practice daily? Even five or ten minutes a day makes a HUGE difference!")
    const promptTimer = setTimeout(() => {
      playMayaDailyGoalPromptVoice();
    }, 200);

    // 3. Cascade cards in sequence
    PRACTICE_OPTIONS.forEach((_, idx) => {
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
      stopMayaDailyGoalPromptVoice();
      stopMayaDailyGoalFeedbackVoice();
    };
  }, []);

  const handleSelectGoal = (item: PracticeOption, index: number) => {
    if (isTransitioning) return;

    // Immediately stop prompt voice
    stopMayaDailyGoalPromptVoice();

    setSelectedGoal(item.id);
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
        stopMayaDailyGoalFeedbackVoice();
        const mins = parseInt(item.id.replace('-min', ''), 10) || 10;
        OnboardingStore.updateField('dailyGoalMinutes', mins);
        authService.syncStep('/onboarding/social-proof');
        router.replace('/onboarding/social-proof');
      }
    };

    // Maya speaks personalized encouraging sentence, waits until finish, then transitions to next screen
    playMayaDailyGoalFeedbackVoice(item.id, {
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
          <ProgressBar progress={0.9} />
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
            <Text style={styles.title}>
              How much can you{'\n'}practice daily?
            </Text>
          </Animated.View>

          {/* Options List with Staggered Entrance */}
          <View style={styles.optionsList}>
            {PRACTICE_OPTIONS.map((item, index) => {
              const isSelected = selectedGoal === item.id;
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
                    onPress={() => handleSelectGoal(item, index)}
                    android_ripple={{ color: '#E2E8F0', borderless: false }}
                  >
                    <View style={styles.cardLeftCol}>
                      {/* Badge Pill for Recommended */}
                      {item.badge && (
                        <View style={styles.badgePill}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}

                      {/* Title */}
                      <Text
                        style={[
                          styles.cardTitle,
                          isSelected && styles.cardTitleActive,
                        ]}
                      >
                        {item.title}
                      </Text>

                      {/* Subtitle */}
                      <Text
                        style={[
                          styles.cardSubtitle,
                          isSelected && styles.cardSubtitleActive,
                        ]}
                      >
                        {item.subtitle}
                      </Text>
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
    paddingVertical: 18,
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
  cardLeftCol: {
    flex: 1,
  },
  cardRecommended: {
    borderColor: '#0D4EFD',
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(13, 78, 253, 0.16)',
      } as any,
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
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D4EFD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 19,
    lineHeight: 25,
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  cardTitleActive: {
    color: '#0D4EFD',
  },
  cardSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    lineHeight: 18,
    color: '#64748B',
  },
  cardSubtitleActive: {
    color: '#64748B',
  },
  checkmarkWrapper: {
    marginLeft: 12,
  },
});
