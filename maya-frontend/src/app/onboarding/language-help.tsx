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
  playUnderstoodTapSound,
  areOnboardingAudiosEnabled,
} from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

export type LanguageModeOption = 'english_only' | 'sinhala_support' | 'deep_guidance';

interface LanguageHelpItem {
  id: LanguageModeOption;
  title: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

const LANGUAGE_HELP_OPTIONS: LanguageHelpItem[] = [
  {
    id: 'english_only',
    title: 'English only',
    subtitle: 'Maya speaks in English only',
    iconName: 'globe-outline',
    iconColor: '#2B5BFF',
    iconBg: '#E0EDFF',
  },
  {
    id: 'sinhala_support',
    title: 'Sinhala Support',
    subtitle: 'Maya mixes Sinhala and English when you need help.',
    iconName: 'chatbubble-ellipses-outline',
    iconColor: '#9333EA',
    iconBg: '#F3E8FF',
  },
  {
    id: 'deep_guidance',
    title: 'Deep Guidance',
    subtitle: 'Maya uses both languages in every turn.',
    iconName: 'book-outline',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
  },
];

export default function LanguageHelpScreen() {
  const { isTablet, isDesktop } = useBreakpoint();
  const currentSaved = (OnboardingStore.getState().languageMode as LanguageModeOption) || null;
  const [selectedOption, setSelectedOption] = useState<LanguageModeOption | null>(currentSaved);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    LANGUAGE_HELP_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(16),
      scale: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    const isAudioOff = !areOnboardingAudiosEnabled();

    // 1. Header entrance
    Animated.parallel([
      Animated.timing(headerOpacityAnim, {
        toValue: 1,
        duration: isAudioOff ? 140 : 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(headerSlideAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // 2. Options cascade
    const animations = cardAnims.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: isAudioOff ? 160 : 300,
          delay: isAudioOff ? index * 30 : index * 70,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(anim.slide, {
          toValue: 0,
          friction: 7,
          tension: 50,
          delay: isAudioOff ? index * 30 : index * 70,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    Animated.stagger(isAudioOff ? 20 : 60, animations).start();
  }, [cardAnims, headerOpacityAnim, headerSlideAnim]);

  const handleSelect = (item: LanguageHelpItem, index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedOption(item.id);

    // Micro spring feedback
    Animated.sequence([
      Animated.timing(cardAnims[index].scale, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(cardAnims[index].scale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    playUnderstoodTapSound();

    // Log analytics event
    authService.logEvent('select_language_mode', '/onboarding/language-help', {
      languageMode: item.id,
      languageModeTitle: item.title,
    });

    let hasNavigated = false;
    const navigateNext = () => {
      if (!hasNavigated) {
        hasNavigated = true;
        OnboardingStore.setLanguageMode(item.id);
        authService.syncStep('/onboarding/social-proof');
        router.replace('/onboarding/social-proof' as any);
      }
    };

    // Smooth delay so user can see their selection feedback before transitioning
    setTimeout(navigateNext, 700);
  };

  const handleBack = () => {
    router.replace('/onboarding/daily-goal' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, (isTablet || isDesktop) && styles.desktopContainer]}>
        {/* Top Navigation & Progress Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>
          <View style={styles.progressContainer}>
            <ProgressBar progress={0.92} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Section */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerOpacityAnim,
                transform: [{ translateY: headerSlideAnim }],
              },
            ]}
          >
            <Text style={styles.title}>How would you like to learn?</Text>
            <Text style={styles.subtitle}>
              Choose how Maya supports you while you practise speaking English.
            </Text>
          </Animated.View>

          {/* Cards List */}
          <View style={styles.optionsList}>
            {LANGUAGE_HELP_OPTIONS.map((item, index) => {
              const isSelected = selectedOption === item.id;
              const cardAnim = cardAnims[index];

              return (
                <Animated.View
                  key={item.id}
                  style={[
                    styles.cardWrapper,
                    {
                      opacity: cardAnim.opacity,
                      transform: [
                        { translateY: cardAnim.slide },
                        { scale: cardAnim.scale },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.card,
                      isSelected && styles.cardSelected,
                      pressed && !isSelected && styles.cardPressed,
                    ]}
                    onPress={() => handleSelect(item, index)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${item.title}, ${item.subtitle}`}
                  >
                    <View style={styles.cardContent}>
                      {/* Left: Icon in circular container */}
                      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                        <Ionicons name={item.iconName} size={22} color={item.iconColor} />
                      </View>

                      {/* Middle: Text */}
                      <View style={styles.textContainer}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {item.title}
                        </Text>
                        <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                      </View>

                      {/* Right: Radio selection indicator */}
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* Bottom Disclaimer */}
          <View style={styles.disclaimerContainer}>
            <Ionicons name="information-circle-outline" size={17} color="#94A3B8" />
            <Text style={styles.disclaimerText}>
              You can change this anytime in Settings.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  desktopContainer: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    paddingRight: 8,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 28,
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  optionsList: {
    gap: 14,
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
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
  cardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#F8FAFF',
    ...Platform.select({
      ios: {
        shadowColor: '#2B5BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 14px rgba(43, 91, 255, 0.12)',
      },
    }),
  },
  cardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#2B5BFF',
  },
  optionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#2B5BFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2B5BFF',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 36,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
});

