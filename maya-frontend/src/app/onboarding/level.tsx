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
  playMayaLevelPromptVoice,
  stopMayaLevelPromptVoice,
  playMayaLevelFeedbackVoice,
  stopMayaLevelFeedbackVoice,
  preloadLevelVoices,
  playUnderstoodTapSound,
} from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

interface LevelOption {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
}

const LEVEL_OPTIONS: LevelOption[] = [
  {
    id: 'beginner',
    icon: '🌱',
    title: 'Beginner',
    subtitle: 'I know basic words and phrases',
  },
  {
    id: 'intermediate',
    icon: '📗',
    title: 'Intermediate',
    subtitle: 'I can hold simple conversations',
  },
  {
    id: 'upper-intermediate',
    icon: '📘',
    title: 'Upper Intermediate',
    subtitle: 'I speak well but make mistakes',
  },
  {
    id: 'advanced',
    icon: '🏆',
    title: 'Advanced',
    subtitle: 'Near-fluent, want to polish',
  },
];

export default function LevelScreen() {
  const { isTablet, isDesktop } = useBreakpoint();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    LEVEL_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(18),
      scale: new Animated.Value(1),
    })),
  ).current;

  // Staggered cascade entrance on mount + prompt audio
  useEffect(() => {
    // 0. Preload level voices
    preloadLevelVoices();

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

    // 2. Play Maya's cheerful question prompt ("What's your current level? Be honest -- I'll meet you right where you are!")
    const promptTimer = setTimeout(() => {
      playMayaLevelPromptVoice();
    }, 200);

    // 3. Cascade cards in sequence
    LEVEL_OPTIONS.forEach((_, idx) => {
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
      stopMayaLevelPromptVoice();
      stopMayaLevelFeedbackVoice();
    };
  }, []);

  const handleSelectLevel = (item: LevelOption, index: number) => {
    if (isTransitioning) return;

    // Immediately stop prompt voice
    stopMayaLevelPromptVoice();

    setSelectedLevel(item.id);
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
        stopMayaLevelFeedbackVoice();
        OnboardingStore.updateField('level', item.id);
        authService.syncStep('/onboarding/employment');
        router.replace('/onboarding/employment' as any);
      }
    };

    // Maya speaks personalized encouraging sentence, waits until finish, then transitions to next screen
    playMayaLevelFeedbackVoice(item.id, {
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
          <ProgressBar progress={0.7} />
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
            <Text style={styles.title}>What's your current level?</Text>
            <Text style={styles.subtitle}>Be honest about your English.</Text>
          </Animated.View>

          {/* Level Options List with Staggered Entrance */}
          <View style={styles.optionsList}>
            {LEVEL_OPTIONS.map((item, index) => {
              const isSelected = selectedLevel === item.id;
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
                    onPress={() => handleSelectLevel(item, index)}
                    android_ripple={{ color: '#E2E8F0', borderless: false }}
                  >
                    <View style={styles.cardContent}>
                      {/* Left Emoji Icon */}
                      <Text style={styles.cardEmoji}>{item.icon}</Text>

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
                        <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
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
  cardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(37, 99, 235, 0.16)',
      } as any,
      default: {
        shadowColor: '#2563EB',
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
  cardEmoji: {
    fontSize: 28,
    marginRight: 16,
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
    color: '#1D4ED8',
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
