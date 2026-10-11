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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { LKFlag } from '@/components/icons/lk-flag';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { Ionicons } from '@expo/vector-icons';
import {
  playMayaPhonePromptVoice,
  stopMayaPhonePromptVoice,
} from '@/services/sound/sound-service';
import { MayaPrimaryButton } from '@/components/ui';

export default function PhoneScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const [phone, setPhone] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const { isDesktop, isTablet } = useBreakpoint();

  const inputRef = useRef<TextInput>(null);

  // Timed Choreography Animated Values
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(16)).current;

  const subtitleOpacityAnim = useRef(new Animated.Value(0)).current;
  const subtitleSlideAnim = useRef(new Animated.Value(12)).current;

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
        playMayaPhonePromptVoice({
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch {}
    }, 350);

    // 2. Timing sequence: Title & Pricing notice appear at ~2100ms
    const subtitleTimer = setTimeout(() => {
      setShowSubtitle(true);
      Animated.parallel([
        Animated.timing(subtitleOpacityAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(subtitleSlideAnim, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, 2100);

    // 3. Timing sequence: Input row appears at ~3800ms
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
      ]).start(() => {
        // Auto-focus on mobile number input once visible
        inputRef.current?.focus();
      });
    }, 3800);

    return () => {
      clearTimeout(voiceTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(inputTimer);
      stopMayaPhonePromptVoice();
    };
  }, []);

  // 4. Timing sequence: Button appears when user types their phone number
  const isPhoneEntered = phone.trim().length > 0;
  useEffect(() => {
    if (isPhoneEntered) {
      Animated.parallel([
        Animated.timing(buttonOpacityAnim, {
          toValue: 1,
          duration: 320,
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
    } else {
      Animated.parallel([
        Animated.timing(buttonOpacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(buttonSlideAnim, {
          toValue: 12,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isPhoneEntered]);

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
      stopMayaPhonePromptVoice();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playMayaPhonePromptVoice({
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleSendCode = () => {
    if (!phone.trim()) return;
    stopMayaPhonePromptVoice();
    setIsSpeaking(false);

    const formattedPhone = phone.trim() ? `+94 ${phone.trim()}` : '+94 77 123 4567';
    router.replace({
      pathname: '/onboarding/otp',
      params: {
        name: params.name || '',
        phone: formattedPhone,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
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
            {/* Top Progress Bar */}
            <View style={styles.progressContainer}>
              <ProgressBar progress={0.25} />
            </View>

            {/* Main Choreographed Stack */}
            <StepTransition style={styles.body}>
              {/* Card 1: Plan & Number Prompt Card (Animates on mount) */}
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
                    <Text style={styles.cardHeader}>
                      To continue, enter your phone number{'\n'}
                      and enable your{' '}
                      <Text style={styles.starterPlanHighlight}>Starter Plan</Text>
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

                  {/* Timed Subtitle Section */}
                  <Animated.View
                    style={{
                      opacity: subtitleOpacityAnim,
                      transform: [{ translateY: subtitleSlideAnim }],
                    }}
                  >
                    <Text style={styles.cardTitle}>
                      Enter your mobile number
                    </Text>
                    <Text style={styles.cardPricingNotice}>
                      Get started for just LKR 12 + tax /day.{'\n'}
                      Cancel anytime.
                    </Text>
                  </Animated.View>
                </Pressable>
              </Animated.View>

              {/* Card 2: Phone Input Row (Timed reveal) */}
              <Animated.View
                style={[
                  styles.inputRow,
                  {
                    opacity: inputOpacityAnim,
                    transform: [{ translateY: inputSlideAnim }],
                  },
                ]}
                pointerEvents={showInput ? 'auto' : 'none'}
              >
                {/* Country Code Pill */}
                <View style={styles.countryBox}>
                  <LKFlag width={26} height={17} />
                  <Text style={styles.countryCode}>+94</Text>
                </View>

                {/* Number Input Box */}
                <View style={styles.numberInputWrapper}>
                  <TextInput
                    ref={inputRef}
                    style={styles.numberInput}
                    placeholder="77 123 4567"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                    }}
                    onKeyPress={(e: any) => {
                      if (e?.nativeEvent?.key === 'Enter') {
                        Keyboard.dismiss();
                      }
                    }}
                  />
                </View>
              </Animated.View>

              {/* Card 3: Common MayaPrimaryButton & Terms Disclosure (Appears when typed) */}
              <Animated.View
                style={[
                  styles.buttonWrapper,
                  {
                    opacity: buttonOpacityAnim,
                    transform: [{ translateY: buttonSlideAnim }],
                  },
                ]}
                pointerEvents={isPhoneEntered ? 'auto' : 'none'}
              >
                <MayaPrimaryButton
                  label="Send Verification Code"
                  showArrow={false}
                  onPress={handleSendCode}
                  height={58}
                  borderRadius={20}
                />

                {/* Terms Disclaimer Text */}
                <Text style={styles.disclaimerText}>
                  By starting the Starter Plan, you agree to our Terms & Conditions.{'\n'}
                  A subscription fee of LKR 12 + applicable taxes per day applies to prepaid users, or LKR 360 + applicable taxes per month for postpaid users. You can cancel anytime.
                </Text>
              </Animated.View>
            </StepTransition>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 20 : 12,
    paddingBottom: 28,
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
  cardHeader: {
    flex: 1,
    ...fontStyle('inter', 'medium'),
    fontSize: 16,
    lineHeight: 24,
    color: '#0F172A',
  },
  starterPlanHighlight: {
    ...fontStyle('outfit', 'bold'),
    color: '#2563EB',
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
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18.5,
    lineHeight: 24,
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  cardPricingNotice: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },

  /* Card 2: Phone Input Row */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    height: 58,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
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
  countryCode: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
  },
  numberInputWrapper: {
    flex: 1,
  },
  numberInput: {
    width: '100%',
    height: 58,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 18,
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

  /* Card 3: Button & Terms */
  buttonWrapper: {
    width: '100%',
    marginTop: 6,
    alignItems: 'center',
  },
  disclaimerText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
});
