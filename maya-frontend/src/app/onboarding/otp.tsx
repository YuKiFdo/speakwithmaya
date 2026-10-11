import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { MayaPrimaryButton } from '@/components/ui';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone?: string; name?: string }>();
  const displayPhone = params.phone || '+94 77 123 4567';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { isDesktop, isTablet } = useBreakpoint();

  // Staged Entrance Animated Values ("appearing thing")
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(16)).current;

  const otpOpacityAnim = useRef(new Animated.Value(0)).current;
  const otpSlideAnim = useRef(new Animated.Value(16)).current;

  const resendOpacityAnim = useRef(new Animated.Value(0)).current;
  const resendSlideAnim = useRef(new Animated.Value(10)).current;

  const buttonOpacityAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(18)).current;

  // Staged appearing sequence on mount
  useEffect(() => {
    // 1. Card appears (0ms)
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

    // 2. OTP Input Boxes appear (350ms)
    const otpTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(otpOpacityAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(otpSlideAnim, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        // Auto-focus on first OTP box once visible
        inputRefs.current[0]?.focus();
      });
    }, 350);

    // 3. Resend countdown text appears (700ms)
    const resendAnimTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(resendOpacityAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(resendSlideAnim, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, 700);

    // 4. Button appears with smooth spring (950ms)
    const buttonTimer = setTimeout(() => {
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
    }, 950);

    return () => {
      clearTimeout(otpTimer);
      clearTimeout(resendAnimTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  // Countdown timer for code resend
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleOtpChange = (text: string, index: number) => {
    // Handle multi-character paste
    if (text.length > 1) {
      const pasted = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      pasted.forEach((char, i) => {
        newOtp[i] = char;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const clean = text.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);

    // Auto-advance to next input
    if (clean && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    setResendTimer(45);
    setCanResend(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const handleVerify = () => {
    router.replace({
      pathname: '/onboarding/goal',
      params: { name: params.name, phone: params.phone },
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
              <ProgressBar progress={0.35} />
            </View>

            {/* Main Staged Stack */}
            <StepTransition style={styles.body}>
              {/* Card 1: Header Prompt Card (Animates in at 0ms) */}
              <Animated.View
                style={[
                  styles.promptCardWrapper,
                  {
                    opacity: cardOpacityAnim,
                    transform: [{ translateY: cardSlideAnim }],
                  },
                ]}
              >
                <View style={styles.promptCard}>
                  <Text style={styles.cardTitle}>
                    Verify your phone number
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Enter the 6-digit code sent to
                  </Text>
                  <View style={styles.phoneRow}>
                    <Text style={styles.phoneNumber}>{displayPhone}</Text>
                    <Pressable
                      onPress={() => router.back()}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit phone number"
                    >
                      <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>

              {/* Card 2: 6 OTP Input Boxes (Animates in at 350ms) */}
              <Animated.View
                style={[
                  styles.otpWrapper,
                  {
                    opacity: otpOpacityAnim,
                    transform: [{ translateY: otpSlideAnim }],
                  },
                ]}
              >
                <View style={styles.otpContainer}>
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => {
                        inputRefs.current[idx] = ref;
                      }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, idx)}
                      onKeyPress={(e) => handleKeyPress(e, idx)}
                      keyboardType="number-pad"
                      maxLength={idx === 0 ? OTP_LENGTH : 1}
                      selectTextOnFocus
                      accessibilityLabel={`Digit ${idx + 1}`}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* Resend Code Section (Animates in at 700ms) */}
              <Animated.View
                style={[
                  styles.resendSection,
                  {
                    opacity: resendOpacityAnim,
                    transform: [{ translateY: resendSlideAnim }],
                  },
                ]}
              >
                {canResend ? (
                  <Pressable onPress={handleResend} hitSlop={8}>
                    <Text style={styles.resendActiveText}>Resend Code</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.resendTimerText}>
                    Didn't receive code? Resend in{' '}
                    <Text style={styles.timerBold}>
                      0:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}
                    </Text>
                  </Text>
                )}
              </Animated.View>

              {/* Card 3: Common MayaPrimaryButton (Animates in at 950ms) */}
              <Animated.View
                style={[
                  styles.buttonWrapper,
                  {
                    opacity: buttonOpacityAnim,
                    transform: [{ translateY: buttonSlideAnim }],
                  },
                ]}
              >
                <MayaPrimaryButton
                  label="Verify and Continue"
                  showArrow={false}
                  onPress={handleVerify}
                  height={58}
                  borderRadius={20}
                />
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
    gap: 20,
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
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
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
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 19.5,
    lineHeight: 26,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    lineHeight: 20,
    color: '#64748B',
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  phoneNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
  },
  editLink: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#2563EB',
  },

  /* Card 2: OTP Input Boxes */
  otpWrapper: {
    width: '100%',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
  },
  otpBox: {
    flex: 1,
    minWidth: 0,
    maxWidth: 52,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    textAlign: 'center',
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0F172A',
    paddingHorizontal: 0,
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
  otpBoxFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },

  /* Resend Code Section */
  resendSection: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  resendTimerText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    color: '#64748B',
  },
  timerBold: {
    ...fontStyle('outfit', 'bold'),
    color: '#0F172A',
  },
  resendActiveText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#2563EB',
  },

  /* Card 3: Button */
  buttonWrapper: {
    width: '100%',
    marginTop: 4,
  },
});
