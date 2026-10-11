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
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  playMayaDailyGoalPromptVoice,
  stopMayaDailyGoalPromptVoice,
  playMayaDailyGoalFeedbackVoice,
  stopMayaDailyGoalFeedbackVoice,
  preloadDailyGoalVoices,
  playUnderstoodTapSound,
} from '@/services/sound/sound-service';

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
    badge: 'Recommended',
    title: '10 min',
    subtitle: 'Recommended for steady growth',
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
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    employment?: string;
  }>();
  const { isTablet, isDesktop } = useBreakpoint();
  const [selectedGoal, setSelectedGoal] = useState<string | null>('10-min');
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
        router.replace({
          pathname: '/onboarding/social-proof',
          params: { ...params, dailyGoal: item.id },
        });
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
              const isRecommended = item.badge === 'Recommended';
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
                      isRecommended && styles.cardRecommended,
                      isSelected && styles.cardSelected,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => handleSelectGoal(item, index)}
                    android_ripple={{ color: '#E2E8F0', borderless: false }}
                  >
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
                        (isSelected || isRecommended) && styles.cardTitleActive,
                      ]}
                    >
                      {item.title}
                    </Text>

                    {/* Subtitle */}
                    <Text
                      style={[
                        styles.cardSubtitle,
                        (isSelected || isRecommended) && styles.cardSubtitleActive,
                      ]}
                    >
                      {item.subtitle}
                    </Text>
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
  },
  desktopContainer: {
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#F8FAFC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 28,
    lineHeight: 36,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  optionsList: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  cardRecommended: {
    borderColor: '#4338CA',
    borderWidth: 2,
    backgroundColor: '#EEF2FF',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(67, 56, 202, 0.12)',
      },
    }),
  },
  cardSelected: {
    borderColor: '#4338CA',
    borderWidth: 2,
    backgroundColor: '#EEF2FF',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(67, 56, 202, 0.12)',
      },
    }),
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#3730A3',
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
    fontSize: 20,
    lineHeight: 26,
    color: '#0F172A',
    marginBottom: 4,
  },
  cardTitleActive: {
    color: '#312E81',
  },
  cardSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  cardSubtitleActive: {
    color: '#4338CA',
  },
});
