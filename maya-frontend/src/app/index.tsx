import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Platform,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import {
  playMayaWelcomeVoice,
  stopMayaWelcomeVoice,
  preloadAllOnboardingVoicesInOrder,
} from '@/services/sound/sound-service';
import { MayaPrimaryButton } from '@/components/ui';
import { OnboardingStore } from '@/services/store/onboarding-store';

export default function WelcomeScreen() {
  const { isDesktop, isTablet } = useBreakpoint();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);

  // Post-auth routes require a valid session to resume into
  const POST_AUTH_ROUTES = [
    '/onboarding/goal', '/onboarding/challenge', '/onboarding/level',
    '/onboarding/language', '/onboarding/employment', '/onboarding/daily-goal',
    '/onboarding/social-proof', '/onboarding/call', '/onboarding/connecting',
    '/onboarding/analyzing', '/onboarding/feedback', '/onboarding/session-review',
    '/onboarding/building-plan', '/onboarding/special-offer', '/onboarding/claim-discount',
    '/onboarding/personalized-plan', '/onboarding/complete',
  ];

  // Auto-resume check on app open: waits for encrypted storage hydration first.
  // If user already finished onboarding, go straight to dashboard.
  // If user dropped off mid-onboarding (e.g. at /onboarding/personalized-plan), resume right there.
  useEffect(() => {
    let mounted = true;

    OnboardingStore.waitForHydration().then(() => {
      if (!mounted) return;
      const state = OnboardingStore.getState();

      if (state.isCompleted && state.isAuthenticated) {
        router.replace('/(tabs)/dashboard');
        return;
      }

      if (state.lastActiveRoute && state.lastActiveRoute !== '/' && state.lastActiveRoute !== '/onboarding/name') {
        // If resuming to a post-auth route, verify we actually have a valid token
        const isPostAuth = POST_AUTH_ROUTES.includes(state.lastActiveRoute) ||
          state.lastActiveRoute.startsWith('/(tabs)');
        if (isPostAuth && !state.isAuthenticated) {
          // Auth was lost — restart from phone verification
          router.replace('/onboarding/phone');
          return;
        }
        router.replace(state.lastActiveRoute as any);
        return;
      }
    });

    return () => { mounted = false; };
  }, []);

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const bubbleScaleAnim = useRef(new Animated.Value(0.9)).current;
  const bubbleOpacityAnim = useRef(new Animated.Value(0)).current;
  const soundWave1 = useRef(new Animated.Value(0.4)).current;
  const soundWave2 = useRef(new Animated.Value(0.8)).current;
  const soundWave3 = useRef(new Animated.Value(0.5)).current;

  // Staged entrance animations
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(24)).current;
  const buttonOpacityAnim = useRef(new Animated.Value(0)).current;

  // Maya avatar subtle breathing / floating animation
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []);

  // Screen entrance choreography + sequential audio preloading
  useEffect(() => {
    // Sequentially pre-download all onboarding voice clips in order
    preloadAllOnboardingVoicesInOrder();

    // 1. Hero Avatar fades in
    Animated.timing(heroFadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // 2. Speech bubble pops in
    Animated.parallel([
      Animated.timing(bubbleOpacityAnim, {
        toValue: 1,
        duration: 450,
        delay: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(bubbleScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        delay: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // 3. Text section smoothly slides up
    Animated.timing(textFadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  // Show button with smooth spring animation
  const triggerButtonAppearance = () => {
    setButtonVisible(true);
    Animated.parallel([
      Animated.timing(buttonOpacityAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(buttonSlideAnim, {
        toValue: 0,
        friction: 6,
        tension: 45,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Soundwave animation when Maya is speaking
  useEffect(() => {
    let waveLoop: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      waveLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(soundWave1, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(soundWave1, { toValue: 0.3, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(soundWave2, { toValue: 0.2, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(soundWave2, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(soundWave3, { toValue: 0.9, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(soundWave3, { toValue: 0.35, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
          ]),
        ]),
      );
      waveLoop.start();
    } else {
      soundWave1.setValue(0.4);
      soundWave2.setValue(0.7);
      soundWave3.setValue(0.5);
    }
    return () => waveLoop?.stop();
  }, [isSpeaking]);

  // Maya friendly voice introduction
  const handlePlayVoiceIntro = () => {
    if (isSpeaking) {
      stopMayaWelcomeVoice();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playMayaWelcomeVoice({
      onStart: () => {
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsSpeaking(false);
        triggerButtonAppearance();
      },
      onError: () => {
        setIsSpeaking(false);
        triggerButtonAppearance();
      },
    });
  };

  // Autoplay voice greeting on mount and sequence button reveal
  useEffect(() => {
    const speechTimer = setTimeout(() => {
      try {
        playMayaWelcomeVoice({
          onStart: () => {
            setIsSpeaking(true);
          },
          onEnd: () => {
            setIsSpeaking(false);
            triggerButtonAppearance();
          },
          onError: () => {
            setIsSpeaking(false);
            triggerButtonAppearance();
          },
        });
      } catch {
        triggerButtonAppearance();
      }
    }, 500);

    // Guaranteed fallback: reveal button after 3.2s so user is never blocked
    const buttonTimer = setTimeout(() => {
      triggerButtonAppearance();
    }, 3200);

    return () => {
      clearTimeout(speechTimer);
      clearTimeout(buttonTimer);
      stopMayaWelcomeVoice();
    };
  }, []);

  const handleGetStarted = () => {
    stopMayaWelcomeVoice();
    setIsSpeaking(false);
    router.push('/onboarding/name');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[
            styles.container,
            (isTablet || isDesktop) && styles.desktopContainer,
          ]}
        >
          {/* Top Section: Maya 3D Avatar with Speech Bubble */}
          <Animated.View
            style={[
              styles.heroAvatarWrapper,
              { opacity: heroFadeAnim },
            ]}
          >
            {/* Animated Speech Bubble pointing to Maya */}
            <Animated.View
              style={[
                styles.speechBubbleContainer,
                {
                  opacity: bubbleOpacityAnim,
                  transform: [{ scale: bubbleScaleAnim }],
                },
              ]}
            >
              <Pressable
                onPress={handlePlayVoiceIntro}
                style={({ pressed }) => [
                  styles.speechBubbleCard,
                  pressed && styles.bubblePressed,
                  isSpeaking && styles.bubbleSpeaking,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Listen to Maya's introduction"
              >
                <Text style={styles.speechBubbleText}>Hi! I'm Maya</Text>

                {/* Animated sound waves or speaker icon */}
                {isSpeaking ? (
                  <View style={styles.soundWaveRow}>
                    <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: soundWave1 }] }]} />
                    <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: soundWave2 }] }]} />
                    <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: soundWave3 }] }]} />
                  </View>
                ) : (
                  <View style={styles.speakerPill}>
                    <Ionicons name="volume-medium" size={14} color="#2563EB" />
                  </View>
                )}
              </Pressable>

              {/* Speech Bubble Tail */}
              <View style={styles.tailWrapper}>
                <Svg width={18} height={14} viewBox="0 0 18 14">
                  <Path d="M0,0 L18,0 C12,5 4,11 2,14 C2,10 0,5 0,0 Z" fill="#ffffff" />
                  <Path d="M0,0 C0,5 2,10 2,14" stroke="#E2E8F0" strokeWidth={1} fill="none" />
                </Svg>
              </View>
            </Animated.View>

            {/* Maya Waving Avatar with Floating Animation */}
            <Pressable onPress={handlePlayVoiceIntro} style={styles.avatarTouch}>
              <Animated.View
                style={[
                  styles.avatarAnimWrapper,
                  { transform: [{ translateY: floatAnim }] },
                ]}
              >
                <Image
                  source={require('@/assets/images/maya-waving.png')}
                  style={styles.mayaAvatarImage}
                  resizeMode="contain"
                  accessibilityLabel="Maya waving"
                />

                {/* Smooth White Bottom Gradient Fade */}
                <View style={styles.bottomFadeOverlay}>
                  <Svg width="100%" height={56} preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="avatarFade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                        <Stop offset="70%" stopColor="#ffffff" stopOpacity="0.85" />
                        <Stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#avatarFade)" />
                  </Svg>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Center Content: Main Heading & Subtitle */}
          <Animated.View style={[styles.textSection, { opacity: textFadeAnim }]}>
            <Text style={styles.headingTitle}>
              Meet <Text style={styles.highlightName}>Maya</Text>,{'\n'}
              your AI English{'\n'}
              Speaking Coach.
            </Text>

            <Text style={styles.subtext}>
              Maya helps you practice real conversations, correct your mistakes, and speak with confidence.
            </Text>
          </Animated.View>

          {/* Bottom Footer: Social Proof & Primary CTA Button */}
          <Animated.View
            style={[
              styles.footerSection,
              {
                opacity: buttonOpacityAnim,
                transform: [{ translateY: buttonSlideAnim }],
              },
            ]}
          >
            <Text style={styles.socialProofText}>
              Join <Text style={styles.socialProofBold}>10,000+ students</Text> already learning
            </Text>

            {/* Common Maya Primary Button with feedback style, glow & sound */}
            <MayaPrimaryButton
              label="Get Started"
              onPress={handleGetStarted}
              height={58}
              borderRadius={22}
            />
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 24 : 12,
    paddingBottom: 28,
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 440,
  },
  desktopContainer: {
    maxWidth: 460,
    paddingTop: 36,
    paddingBottom: 36,
  },

  /* 3D Maya Avatar & Speech Bubble */
  heroAvatarWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 8,
    marginBottom: 4,
  },
  speechBubbleContainer: {
    position: 'absolute',
    top: 0,
    right: 28,
    zIndex: 10,
    alignItems: 'flex-start',
  },
  speechBubbleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.08)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
      },
    }),
  },
  bubblePressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: '#F8FAFC',
  },
  bubbleSpeaking: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  speechBubbleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  speakerPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 16,
    paddingHorizontal: 2,
  },
  soundWaveBar: {
    width: 3,
    height: 14,
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
  tailWrapper: {
    marginLeft: 18,
    marginTop: -1,
  },
  avatarTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAnimWrapper: {
    width: 270,
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mayaAvatarImage: {
    width: '100%',
    height: '100%',
  },
  bottomFadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  /* Center Text Hierarchy */
  textSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  headingTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 34,
    lineHeight: 42,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  highlightName: {
    color: '#2563EB',
  },
  subtext: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15.5,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 324,
  },

  /* Footer Section */
  footerSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
  socialProofText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  socialProofBold: {
    ...fontStyle('inter', 'semiBold'),
    color: '#334155',
  },
});
