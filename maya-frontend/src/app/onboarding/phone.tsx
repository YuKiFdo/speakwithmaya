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
import { mayaAlert } from '@/components/ui/alert-modal';
import { authService } from '@/services/auth/auth-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';

export default function PhoneScreen() {
  const params = useLocalSearchParams<{ edit?: string; mode?: string; registered?: string }>();
  const isEditing = params.edit === '1' || params.edit === 'true';
  const [forcedLoginMode, setForcedLoginMode] = useState(false);
  const isLoginMode = params.mode === 'login' || forcedLoginMode;

  const [phone, setPhone] = useState(() => {
    const stored = OnboardingStore.getState().phone || '';
    return stored.startsWith('+94') ? stored.slice(3) : stored;
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(isEditing || isLoginMode);
  const [showInput, setShowInput] = useState(isEditing || isLoginMode);
  const [isLoading, setIsLoading] = useState(false);
  const { isDesktop, isTablet } = useBreakpoint();

  // Dynamic CMS Text & SMS Gateway Settings
  const [activeGateway, setActiveGateway] = useState<'smsapi' | 'ideamart' | 'mspace' | 'telco'>('smsapi');
  const [pricingNoticeText, setPricingNoticeText] = useState('');
  const [disclaimerTextContent, setDisclaimerTextContent] = useState('');
  const [ideamartEnabled, setIdeamartEnabled] = useState(true);
  const [mspaceEnabled, setMspaceEnabled] = useState(true);

  useEffect(() => {
    fetch(`${getBackendBaseUrl()}/v1/app-config`)
      .then((res) => res.json())
      .then((config) => {
        const gateway = config?.smsGateway || 'smsapi';
        const ideaOn = config?.ideamartEnabled ?? true;
        const mspaceOn = config?.mspaceEnabled ?? true;

        setActiveGateway(gateway);
        setIdeamartEnabled(ideaOn);
        setMspaceEnabled(mspaceOn);

        if (gateway === 'ideamart' || gateway === 'mspace' || gateway === 'telco') {
          let defaultPricing = 'Dialog / Mobitel / Hutch: LKR 5 + tax /day. Airtime billing.';
          let defaultDisclaimer =
            'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog, Mobitel, or Hutch mobile balance.';

          if (ideaOn && !mspaceOn) {
            defaultPricing = 'Dialog / Hutch: LKR 5 + tax /day. Airtime billing.';
            defaultDisclaimer =
              'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog or Hutch mobile balance.';
          } else if (!ideaOn && mspaceOn) {
            defaultPricing = 'Mobitel: LKR 5 + tax /day. Airtime billing.';
            defaultDisclaimer =
              'By subscribing, LKR 5 + taxes per day will be deducted from your Mobitel mobile balance.';
          }

          setPricingNoticeText(config.ideamartPricingNotice || defaultPricing);
          setDisclaimerTextContent(config.ideamartTermsDisclaimer || defaultDisclaimer);
        } else {
          setPricingNoticeText(config?.pricingNotice || '');
          setDisclaimerTextContent(config?.termsDisclaimer || '');
        }
      })
      .catch(() => {});
  }, []);

  const inputRef = useRef<TextInput>(null);

  // Timed Choreography Animated Values
  const cardOpacityAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 1 : 0)).current;
  const cardSlideAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 0 : 16)).current;

  const subtitleOpacityAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 1 : 0)).current;
  const subtitleSlideAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 0 : 12)).current;

  const inputOpacityAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 1 : 0)).current;
  const inputSlideAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 0 : 14)).current;

  const buttonOpacityAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 1 : 0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(isEditing || isLoginMode ? 0 : 14)).current;

  // Soundwave animation bars
  const wave1 = useRef(new Animated.Value(0.4)).current;
  const wave2 = useRef(new Animated.Value(0.8)).current;
  const wave3 = useRef(new Animated.Value(0.5)).current;

  // 1. Initial entrance on mount: Card appears & voice starts
  useEffect(() => {
    if (isEditing || isLoginMode) {
      // Immediately reveal everything and focus input
      setShowSubtitle(true);
      setShowInput(true);
      cardOpacityAnim.setValue(1);
      cardSlideAnim.setValue(0);
      subtitleOpacityAnim.setValue(1);
      subtitleSlideAnim.setValue(0);
      inputOpacityAnim.setValue(1);
      inputSlideAnim.setValue(0);
      buttonOpacityAnim.setValue(1);
      buttonSlideAnim.setValue(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return;
    }

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

    // 3. Timing sequence: Input row & Button appear at ~3800ms
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
  }, [isEditing, isLoginMode]);

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

  // Button is enabled only when phone number is typed
  const isPhoneEntered = phone.trim().length > 0;

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

  const handleSendCode = async () => {
    if (!phone.trim() || isLoading) return;
    stopMayaPhonePromptVoice();
    setIsSpeaking(false);

    const cleanInput = phone.trim().replace(/\s+/g, '');
    const digits = cleanInput.startsWith('+94')
      ? cleanInput.slice(3)
      : cleanInput.startsWith('94')
      ? cleanInput.slice(2)
      : cleanInput.startsWith('0')
      ? cleanInput.slice(1)
      : cleanInput;

    // Operator Carrier validation for Telco Mobile Balance Billing (ONLY during new registration, NEVER in Login mode)
    if (!isLoginMode && (activeGateway === 'ideamart' || activeGateway === 'mspace' || activeGateway === 'telco')) {
      const prefix = digits.slice(0, 2);
      const isMobitel = ['70', '71'].includes(prefix);
      const isDialogOrHutch = ['77', '76', '74', '78', '72', '75'].includes(prefix);

      if (isMobitel && !mspaceEnabled) {
        mayaAlert.toast(
          'Mobile balance billing is currently unavailable for Mobitel numbers. Please enter a Dialog or Hutch number.',
          'error',
        );
        return;
      }

      if (isDialogOrHutch && !ideamartEnabled) {
        mayaAlert.toast(
          'Mobile balance billing is currently unavailable for Dialog and Hutch numbers. Please enter a Mobitel number.',
          'error',
        );
        return;
      }

      if (!isMobitel && !isDialogOrHutch) {
        if (ideamartEnabled && mspaceEnabled) {
          mayaAlert.toast(
            'Mobile balance billing is available for Dialog, Mobitel, and Hutch numbers. Please enter a valid mobile number.',
            'error',
          );
        } else if (ideamartEnabled) {
          mayaAlert.toast(
            'Mobile balance billing is currently available for Dialog and Hutch numbers. Please enter a valid mobile number.',
            'error',
          );
        } else if (mspaceEnabled) {
          mayaAlert.toast(
            'Mobile balance billing is currently available for Mobitel numbers. Please enter a valid mobile number.',
            'error',
          );
        } else {
          mayaAlert.toast('Mobile balance billing is currently unavailable. Please try again later.', 'error');
        }
        return;
      }
    }

    const formattedPhone = cleanInput.startsWith('+')
      ? cleanInput
      : cleanInput.startsWith('0')
      ? `+94${cleanInput.substring(1)}`
      : cleanInput.startsWith('94')
      ? `+${cleanInput}`
      : `+94${cleanInput}`;

    setIsLoading(true);
    try {
      const res = await authService.sendOtp(formattedPhone, { isLoginMode });
      OnboardingStore.updateField('phone', formattedPhone);
      setPhone(digits);

      // If phone number is already registered while on the Register screen,
      // show toast notice and switch to Login mode with the phone number pre-filled
      if (res.alreadyRegistered) {
        setForcedLoginMode(true);
        mayaAlert.toast(
          res.message ||
            'This phone number is already registered. Switched to Login mode — tap Log In to receive your code.',
          'info',
          4500,
        );
        router.replace('/onboarding/phone?mode=login' as any);
        return;
      }

      // If this is a registered test account, bypass OTP verification directly into the dashboard
      if (res.isTestAccount) {
        router.replace('/(tabs)/dashboard');
        return;
      }

      const otpUrl = isLoginMode ? '/onboarding/otp?mode=login' : '/onboarding/otp';
      router.replace(otpUrl as any);
    } catch (err: any) {
      mayaAlert.toast(
        err.message || 'Failed to send verification code. Please check your number.',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
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
                      {isLoginMode ? (
                        <>
                          Welcome back! Enter your phone number{'\n'}
                          to log into your <Text style={styles.starterPlanHighlight}>account</Text>
                        </>
                      ) : (
                        <>
                          To continue, enter your phone number{'\n'}
                          and enable your{' '}
                          <Text style={styles.starterPlanHighlight}>Starter Plan</Text>
                        </>
                      )}
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
                    {!isLoginMode && !!pricingNoticeText && (
                      <Text style={styles.cardPricingNotice}>
                        {pricingNoticeText}
                      </Text>
                    )}
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
                    pointerEvents: showInput ? 'auto' : 'none',
                  },
                ]}
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
                </View>
              </Animated.View>

              {/* Card 3: Common MayaPrimaryButton & Terms Disclosure (Default shown, disabled until typed) */}
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
                  label={isLoading ? "Sending..." : isLoginMode ? "Log In" : "Send Verification Code"}
                  showArrow={false}
                  disabled={!isPhoneEntered || isLoading}
                  onPress={handleSendCode}
                  height={58}
                  borderRadius={20}
                />

                {/* Terms Disclaimer Text: Only rendered when configured for Ideamart telco gateway */}
                {!isLoginMode && !!disclaimerTextContent && (
                  <Text style={styles.disclaimerText}>
                    {disclaimerTextContent}
                  </Text>
                )}

                {/* Switch between Login and Registration */}
                <Pressable
                  onPress={() => {
                    stopMayaPhonePromptVoice();
                    setIsSpeaking(false);
                    setForcedLoginMode(false);
                    if (isLoginMode) {
                      router.replace('/onboarding/name');
                    } else {
                      router.replace('/onboarding/phone?mode=login' as any);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.modeSwitchRow,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.modeSwitchNormal}>
                    {isLoginMode ? "Don't have an account? " : 'Already have an account? '}
                  </Text>
                  <Text style={styles.modeSwitchBold}>
                    {isLoginMode ? 'Get Started' : 'Login'}
                  </Text>
                </Pressable>
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
  modeSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
  },
  modeSwitchNormal: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    color: '#64748B',
  },
  modeSwitchBold: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14.5,
    color: '#0F172A',
  },
});
