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
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { playUnderstoodTapSound } from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

export type AICorrectionOption = 'let_me_speak' | 'keep_on_track' | 'correct_instantly';

interface CorrectionOptionItem {
  id: AICorrectionOption;
  badge?: string;
  title: string;
  subtitle: string;
  iconName: any;
  iconLibrary: 'material' | 'feather';
  iconColor: string;
  iconBg: string;
}

const CORRECTION_OPTIONS: CorrectionOptionItem[] = [
  {
    id: 'let_me_speak',
    title: 'Let me speak',
    subtitle: 'No interruptions. Review and feedback at the end.',
    iconName: 'sprout',
    iconLibrary: 'material',
    iconColor: '#059669',
    iconBg: '#E6F9F0',
  },
  {
    id: 'keep_on_track',
    badge: 'RECOMMENDED',
    title: 'Keep me on track',
    subtitle: 'Occasional gentle corrections when needed.',
    iconName: 'scale-balance',
    iconLibrary: 'material',
    iconColor: '#2B5BFF',
    iconBg: '#E0EDFF',
  },
  {
    id: 'correct_instantly',
    title: 'Correct me instantly',
    subtitle: 'Every time I make a grammar or phrasing mistake.',
    iconName: 'zap',
    iconLibrary: 'feather',
    iconColor: '#DB2777',
    iconBg: '#FCE7F3',
  },
];

export default function CorrectionModeScreen() {
  const { isTablet, isDesktop } = useBreakpoint();
  const currentSaved = OnboardingStore.getState().aiCorrectionMode || 'keep_on_track';
  const [selectedMode, setSelectedMode] = useState<AICorrectionOption>(currentSaved);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Staggered Entrance Animations
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(14)).current;

  const cardAnims = useRef(
    CORRECTION_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(18),
      scale: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    // 1. Header fades & slides in
    Animated.parallel([
      Animated.timing(headerOpacityAnim, {
        toValue: 1,
        duration: 150,
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

    // 2. Cascade cards in sequence
    CORRECTION_OPTIONS.forEach((_, idx) => {
      const delay = idx * 30;
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(cardAnims[idx].opacity, {
            toValue: 1,
            duration: 150,
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
  }, []);

  const handleSelect = (item: CorrectionOptionItem, index: number) => {
    if (isTransitioning) return;

    setSelectedMode(item.id);
    setIsTransitioning(true);

    // Tactile pop animation on tapped card
    Animated.sequence([
      Animated.timing(cardAnims[index].scale, {
        toValue: 0.97,
        duration: 80,
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
        OnboardingStore.updateField('aiCorrectionMode', item.id);
        authService.syncStep('/onboarding/social-proof');
        router.replace('/onboarding/social-proof');
      }
    };

    setTimeout(navigateNext, 120);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, (isTablet || isDesktop) && styles.desktopContainer]}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.94} />
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
              How should Maya{'\n'}correct you?
            </Text>
            <Text style={styles.subtitle}>
              Choose how active you want AI feedback to be during speaking practice.
            </Text>
          </Animated.View>

          {/* Options List with Staggered Entrance */}
          <View style={styles.optionsList}>
            {CORRECTION_OPTIONS.map((item, index) => {
              const isSelected = selectedMode === item.id;
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
                    onPress={() => handleSelect(item, index)}
                    android_ripple={{ color: '#E2E8F0', borderless: false }}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
                        {item.iconLibrary === 'feather' ? (
                          <Feather name={item.iconName} size={22} color={item.iconColor} />
                        ) : (
                          <MaterialCommunityIcons name={item.iconName} size={24} color={item.iconColor} />
                        )}
                      </View>

                      {item.badge && (
                        <View style={styles.badgePill}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardTextCol}>
                      <Text style={[styles.cardTitle, isSelected && styles.cardTitleActive]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.cardSubtitle, isSelected && styles.cardSubtitleActive]}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <View style={styles.cardRadioCol}>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                    </View>
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  desktopContainer: {
    maxWidth: 520,
    paddingHorizontal: 20,
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
    paddingTop: 16,
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
    marginBottom: 8,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  optionsList: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 18,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#F8FAFF',
  },
  cardPressed: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  cardTextCol: {
    paddingRight: 32,
    marginBottom: 4,
  },
  cardTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 18,
    lineHeight: 24,
    color: '#0F172A',
    marginBottom: 4,
  },
  cardTitleActive: {
    color: '#2B5BFF',
  },
  cardSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  cardSubtitleActive: {
    color: '#475569',
  },
  cardRadioCol: {
    position: 'absolute',
    right: 18,
    top: '50%',
    marginTop: -10,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    borderColor: '#2B5BFF',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2B5BFF',
  },
});
