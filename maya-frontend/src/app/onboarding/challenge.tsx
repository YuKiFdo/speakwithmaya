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
import { Ionicons } from '@expo/vector-icons';
import {
  playMayaChallengeFeedbackVoice,
  stopMayaChallengeFeedbackVoice,
  playMayaChallengePromptVoice,
  stopMayaChallengePromptVoice,
  preloadChallengeVoices,
  playUnderstoodTapSound,
} from '@/services/sound/sound-service';

interface ChallengeOption {
  id: string;
  icon: string;
  title: string;
}

const CHALLENGE_OPTIONS: ChallengeOption[] = [
  {
    id: 'speaking-confidently',
    icon: '😰',
    title: 'Speaking confidently',
  },
  {
    id: 'getting-stuck',
    icon: '🔄',
    title: 'Getting stuck in conversations',
  },
  {
    id: 'listening',
    icon: '👂',
    title: 'Listening and understanding',
  },
  {
    id: 'grammar',
    icon: '📝',
    title: 'Grammar mistakes',
  },
  {
    id: 'vocabulary',
    icon: '📚',
    title: 'Limited vocabulary',
  },
];

export default function ChallengeScreen() {
  const params = useLocalSearchParams<{ phone?: string; name?: string; goal?: string }>();
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    CHALLENGE_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(18),
      scale: new Animated.Value(1),
    })),
  ).current;

  // Staggered cascade entrance on mount + question audio prompt
  useEffect(() => {
    // Preload all challenge voice audio files into memory immediately on entrance
    preloadChallengeVoices();

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

    // 2. Play Maya's gentle question prompt ("What's hardest for you right now? Pick your biggest challenge when speaking English.")
    const promptTimer = setTimeout(() => {
      playMayaChallengePromptVoice();
    }, 200);

    // 3. Cascade cards in sequence as Maya introduces the question
    CHALLENGE_OPTIONS.forEach((_, idx) => {
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
      stopMayaChallengePromptVoice();
      stopMayaChallengeFeedbackVoice();
    };
  }, []);

  const handleSelectChallenge = (item: ChallengeOption, index: number) => {
    if (isTransitioning) return;

    // Immediately stop question prompt if still playing
    stopMayaChallengePromptVoice();

    setSelectedChallenge(item.id);
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
        stopMayaChallengeFeedbackVoice();
        router.replace({
          pathname: '/onboarding/level',
          params: { ...params, challenge: item.id },
        });
      }
    };

    // Maya speaks personalized encouraging sentence, waits until finish, then transitions to next screen
    playMayaChallengeFeedbackVoice(item.id, {
      onEnd: () => {
        // Natural breath pause after she finishes speaking her full sentence
        setTimeout(navigateNext, 300);
      },
      onError: () => {
        setTimeout(navigateNext, 600);
      },
    });

    // Extreme fallback: only in case browser audio engine stalls completely without firing events
    setTimeout(navigateNext, 12000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.6} />
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
            <Text style={styles.title}>What's hardest for you?</Text>
            <Text style={styles.subtitle}>Pick your biggest challenge right now.</Text>
          </Animated.View>

          {/* Challenge Options List with Staggered Entrance */}
          <View style={styles.optionsList}>
            {CHALLENGE_OPTIONS.map((item, index) => {
              const isSelected = selectedChallenge === item.id;
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
                    onPress={() => handleSelectChallenge(item, index)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View style={styles.cardLeftCol}>
                      <View style={styles.iconWrapper}>
                        <Text style={styles.iconText}>{item.icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.cardTitle,
                          isSelected && styles.cardTitleSelected,
                        ]}
                      >
                        {item.title}
                      </Text>
                    </View>

                    {/* Blue Checkmark Indicator when selected */}
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

  /* Option Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 20,
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
  cardPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: '#F8FAFC',
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
  cardLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 26,
  },
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    lineHeight: 23,
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
  },
  cardTitleSelected: {
    color: '#1D4ED8',
  },
  checkmarkWrapper: {
    marginLeft: 12,
  },
});
