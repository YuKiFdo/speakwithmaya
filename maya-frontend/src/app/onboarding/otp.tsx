import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors, Radii } from '@/theme/tokens';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone?: string; name?: string }>();
  const displayPhone = params.phone || '+94 77 123 4567';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { isDesktop, isTablet } = useBreakpoint();

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
    const code = otp.join('');
    router.replace({
      pathname: '/onboarding/goal',
      params: { name: params.name, phone: params.phone },
    });
  };

  const isComplete = otp.every((digit) => digit.length === 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.container}>
          {/* Top Progress Bar */}
          <View style={styles.progressContainer}>
            <ProgressBar progress={0.4} />
          </View>

          {/* Main Content */}
          <StepTransition style={styles.body}>
            {/* Header Prompt Card */}
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

            {/* OTP Input Boxes */}
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
                  autoFocus={idx === 0}
                  accessibilityLabel={`Digit ${idx + 1}`}
                />
              ))}
            </View>

            {/* Resend Code Section */}
            <View style={styles.resendSection}>
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
            </View>
          </StepTransition>

          {/* Bottom CTA Button */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                !isComplete && styles.ctaButtonDisabled,
                pressed && isComplete && styles.ctaButtonPressed,
              ]}
              onPress={handleVerify}
              disabled={!isComplete}
              accessibilityRole="button"
              accessibilityLabel="Verify and Continue"
            >
              <Text style={styles.ctaButtonText}>Verify & Continue</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  progressContainer: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  body: {
    flex: 1,
    gap: 24,
    paddingTop: 100,
  },
  promptCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.primary,
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
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 0,
  },
  otpBoxFilled: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#f0f9ff',
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendTimerText: {
    fontSize: 14,
    color: '#64748b',
  },
  timerBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  resendActiveText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.primary,
  },
  footer: {
    width: '100%',
    paddingBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#0085db',
    width: '100%',
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonPressed: {
    backgroundColor: '#0072bc',
    transform: [{ scale: 0.99 }],
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
