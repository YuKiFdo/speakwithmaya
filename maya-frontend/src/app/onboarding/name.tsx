import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
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

export default function NameScreen() {
  const [name, setName] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { isDesktop, isTablet } = useBreakpoint();

  // Subtle soundwave animations for speaking state
  const wave1 = useRef(new Animated.Value(0.4)).current;
  const wave2 = useRef(new Animated.Value(0.8)).current;
  const wave3 = useRef(new Animated.Value(0.5)).current;

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

  // Autoplay voice greeting on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        playMayaNamePromptVoice({
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch {}
    }, 450);

    return () => {
      clearTimeout(timer);
      stopMayaNamePromptVoice();
    };
  }, []);

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
    stopMayaNamePromptVoice();
    setIsSpeaking(false);
    router.replace({
      pathname: '/onboarding/phone',
      params: { name: name.trim() },
    });
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

          {/* Main Card Stack */}
          <StepTransition style={styles.body}>
            {/* Card 1: Maya Greeting Card */}
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

                {/* Speaker / Pulsing Soundwave badge */}
                <View style={styles.speakerBadge}>
                  {isSpeaking ? (
                    <View style={styles.soundWaveRow}>
                      <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave1 }] }]} />
                      <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave2 }] }]} />
                      <Animated.View style={[styles.soundWaveBar, { transform: [{ scaleY: wave3 }] }]} />
                    </View>
                  ) : (
                    <Ionicons name="volume-medium" size={15} color="#2563EB" />
                  )}
                </View>
              </View>

              <Text style={styles.cardQuestion}>
                What should I call you?
              </Text>
            </Pressable>

            {/* Card 2: Input Box */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Your first name..."
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>

            {/* Card 3: Continue Button placed directly below input */}
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.ctaButtonText}>Continue</Text>
            </Pressable>
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
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
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
    backgroundColor: '#2563EB',
    borderRadius: 1.5,
  },
  cardQuestion: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18.5,
    lineHeight: 24,
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  /* Card 2: Input */
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
  ctaButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
  },
  ctaButtonPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.985 }],
  },
  ctaButtonText: {
    ...fontStyle('outfit', 'bold'),
    color: '#FFFFFF',
    fontSize: 17.5,
    letterSpacing: -0.2,
  },
});
