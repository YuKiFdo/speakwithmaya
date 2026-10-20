import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { Ionicons } from '@expo/vector-icons';
import {
  playMayaNamePromptVoice,
  stopMayaNamePromptVoice,
} from '@/services/sound/sound-service';
import { MayaPrimaryButton } from '@/components/ui';
import { OnboardingStore } from '@/services/store/onboarding-store';

export default function NameScreen() {
  const [name, setName] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const { isDesktop, isTablet } = useBreakpoint();

  const inputRef = useRef<TextInput>(null);

  // Timed Choreography Animated Values
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(16)).current;

  const questionOpacityAnim = useRef(new Animated.Value(0)).current;
  const questionSlideAnim = useRef(new Animated.Value(12)).current;

  const inputOpacityAnim = useRef(new Animated.Value(0)).current;
  const inputSlideAnim = useRef(new Animated.Value(14)).current;

  const buttonOpacityAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(14)).current;

  // Soundwave animation bars
  const wave1 = useRef(new Animated.Value(0.4)).current;
  const wave2 = useRef(new Animated.Value(0.8)).current;
  const wave3 = useRef(new Animated.Value(0.5)).current;

  // 1. Initial entrance on mount: Card appears & voice starts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Voice starts speaking line 1
    const voiceTimer = setTimeout(() => {
      try {
        playMayaNamePromptVoice({
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch {}
    }, 350);

    // 2. Timing sequence: "What should I call you?" appears at ~2000ms
    const questionTimer = setTimeout(() => {
      setShowQuestion(true);
      Animated.parallel([
        Animated.timing(questionOpacityAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(questionSlideAnim, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, 2000);

    // 3. Timing sequence: Input box & Button appear at ~3600ms
    const inputTimer = setTimeout(() => {
      setShowInput(true);
      Animated.parallel([
        Animated.timing(inputOpacityAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(inputSlideAnim, {
          toValue: 0,
          friction: 6,
          tension: 45,
          useNativeDriver: Platform.OS !== 'web',
        }),
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
      ]).start(() => {
        // Fallback focus check
        inputRef.current?.focus();
      });
    }, 3600);

    return () => {
      clearTimeout(voiceTimer);
      clearTimeout(questionTimer);
      clearTimeout(inputTimer);
      stopMayaNamePromptVoice();
    };
  }, []);

  // iOS-compatible auto-focus: Triggers immediately when showInput switches to true
  // with a slight tick to allow iOS UIKit responder chain & pointerEvents to settle
  useEffect(() => {
    if (showInput) {
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, Platform.OS === 'ios' ? 120 : 50);

      return () => clearTimeout(focusTimer);
    }
  }, [showInput]);

  // Button is enabled only when name is typed
  const isNameEntered = name.trim().length > 0;

  // Soundwave animation while Maya is speaking
  useEffect(() => {
    let waveLoop: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      waveLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wave1, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave1, { toValue: 0.3, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave2, { toValue: 0.2, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave2, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave3, { toValue: 0.9, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave3, { toValue: 0.35, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
          ]),
        ]),
      );
      waveLoop.start();
    } else {
      wave1.setValue(0.4);
      wave2.setValue(0.7);
      wave3.setValue(0.5);
    }
    return () => waveLoop?.stop();
  }, [isSpeaking]);

  const handleToggleVoice = () => {
    if (isSpeaking) {
      stopMayaNamePromptVoice();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playMayaNamePromptVoice({
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleContinue = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    stopMayaNamePromptVoice();
    setIsSpeaking(false);
    OnboardingStore.updateField('name', cleanName);
    OnboardingStore.setLastActiveRoute('/onboarding/phone');
    router.replace('/onboarding/phone');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View
          style={[
            styles.container,
            (isTablet || isDesktop) && styles.desktopContainer,
          ]}
        >
          {/* Top Progress Bar */}
          <View style={styles.progressContainer}>
            <ProgressBar progress={0.15} />
          </View>

          {/* Main Choreographed Stack */}
          <StepTransition style={styles.body}>
            {/* Card 1: Maya Greeting Card (Animates on mount) */}
            <Animated.View
              style={[
                styles.promptCardWrapper,
                {
                  opacity: cardOpacityAnim,
                  transform: [{ translateY: cardSlideAnim }],
                },
              ]}
            >
              <Pressable
                onPress={handleToggleVoice}
                style={({ pressed }) => [
                  styles.promptCard,
                  pressed && styles.promptCardPressed,
                  isSpeaking && styles.promptCardSpeaking,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Listen to Maya"
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardGreeting}>
                    Hi! I'm Maya, your personal English speaking coach. 👋
                  </Text>

                  {/* Speaker badge */}
                  <View style={styles.speakerBadge}>
                    {isSpeaking ? (
                      <View style={styles.soundWaveRow}>
                        <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave1 }] }]} />
                        <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave2 }] }]} />
                        <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave3 }] }]} />
                      </View>
                    ) : (
                      <Ionicons name="volume-medium" size={15} color="#0284C7" />
                    )}
                  </View>
                </View>

                {/* Question line: Timed reveal */}
                <Animated.View
                  style={{
                    opacity: questionOpacityAnim,
                    transform: [{ translateY: questionSlideAnim }],
                  }}
                >
                  <Text style={styles.cardQuestion}>
                    What should I call you?
                  </Text>
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Card 2: Input Box (Timed reveal) */}
            <Animated.View
              style={[
                styles.inputWrapper,
                {
                  opacity: inputOpacityAnim,
                  transform: [{ translateY: inputSlideAnim }],
                  pointerEvents: showInput ? 'auto' : 'none',
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Your first name..."
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={true}
                showSoftInputOnFocus={true}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                }}
                onKeyPress={(e: any) => {
                  if (e?.nativeEvent?.key === 'Enter') {
                    Keyboard.dismiss();
                  }
                }}
              />
            </Animated.View>

            {/* Card 3: Common MayaPrimaryButton (Default shown, disabled until typed) */}
            <Animated.View
              style={[
                styles.buttonWrapper,
                {
                  opacity: buttonOpacityAnim,
                  transform: [{ translateY: buttonSlideAnim }],
                  pointerEvents: showInput ? 'auto' : 'none',
                },
              ]}
            >
              <MayaPrimaryButton
                label="Continue"
                disabled={!isNameEntered}
                onPress={handleContinue}
                height={58}
                borderRadius={20}
              />

              {/* Already have an account? Login */}
              <Pressable
                onPress={() => {
                  stopMayaNamePromptVoice();
                  setIsSpeaking(false);
                  OnboardingStore.setLastActiveRoute('/onboarding/phone?mode=login');
                  router.replace('/onboarding/phone?mode=login' as any);
                }}
                style={({ pressed }) => [
                  styles.loginRow,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Already have an account? Log in"
              >
                <Text style={styles.loginTextNormal}>Already have an account ? </Text>
                <Text style={styles.loginTextBold}>Login</Text>
              </Pressable>
            </Animated.View>
          </StepTransition>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 20 : 12,
    paddingBottom: 24,
    maxWidth: 440,
    alignSelf: 'center',
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
    paddingTop: 36,
  },
  progressContainer: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 36,
  },
  body: {
    width: '100%',
    gap: 16,
  },

  /* Card 1: Prompt Card */
  promptCardWrapper: {
    width: '100%',
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      },
    }),
  },
  promptCardPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: '#F8FAFC',
  },
  promptCardSpeaking: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F7FF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardGreeting: {
    flex: 1,
    ...fontStyle('inter', 'medium'),
    fontSize: 16.5,
    lineHeight: 24,
    color: '#0F172A',
  },
  speakerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  soundWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 14,
    paddingHorizontal: 2,
  },
  soundWaveBar: {
    width: 2.5,
    height: 12,
    backgroundColor: '#0284C7',
    borderRadius: 1.5,
  },
  cardQuestion: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18.5,
    lineHeight: 24,
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  /* Card 2: Input Box */
  inputWrapper: {
    width: '100%',
  },
  textInput: {
    width: '100%',
    height: 58,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 20,
    ...fontStyle('inter', 'regular'),
    fontSize: 16.5,
    color: '#0F172A',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
      },
    }),
  },

  /* Card 3: Action Button */
  buttonWrapper: {
    width: '100%',
    marginTop: 6,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
  },
  loginTextNormal: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    color: '#64748B',
  },
  loginTextBold: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14.5,
    color: '#0F172A',
  },
});
