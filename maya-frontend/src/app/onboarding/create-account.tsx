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
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { LKFlag } from '@/components/icons/lk-flag';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { mayaAlert } from '@/components/ui/alert-modal';
import { authService } from '@/services/auth/auth-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { playUnderstoodTapSound } from '@/services/sound/sound-service';
import { MayaPrimaryButton } from '@/components/ui';

export default function CreateAccountScreen() {
  const { isDesktop, isTablet } = useBreakpoint();

  const [name, setName] = useState(() => OnboardingStore.getState().name || '');
  const [phone, setPhone] = useState(() => {
    const stored = OnboardingStore.getState().phone || '';
    return stored.startsWith('+94') ? stored.slice(3) : stored;
  });
  const [email, setEmail] = useState(() => OnboardingStore.getState().email || '');

  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'email' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic pricing & legal disclaimer from CMS config (reacts to SMS gateway type)
  const [disclaimerText, setDisclaimerText] = useState(
    'By starting the Starter Plan, you agree to our Terms & Conditions. A subscription fee of LKR 12 + applicable taxes per day applies to prepaid users, or LKR 360 + applicable taxes per month for postpaid users. You can cancel anytime.',
  );
  const [subheadingText, setSubheadingText] = useState(
    'Creating your account activates the Starter Plan, billed daily through your mobile carrier. Cancel anytime.',
  );

  useEffect(() => {
    fetch(`${getBackendBaseUrl()}/v1/app-config`)
      .then((res) => res.json())
      .then((config) => {
        const gateway = config?.smsGateway || 'smsapi';
        const isTelco = gateway === 'ideamart' || gateway === 'mspace' || gateway === 'telco';

        if (isTelco) {
          const defaultDisclaimer =
            'By starting the Starter Plan, you agree to our Terms & Conditions. A subscription fee of LKR 12 + applicable taxes per day applies to prepaid users, or LKR 360 + applicable taxes per month for postpaid users. You can cancel anytime.';
          const defaultSubheading =
            'Creating your account activates the Starter Plan, billed daily through your mobile carrier. Cancel anytime.';

          setDisclaimerText(config?.ideamartTermsDisclaimer || defaultDisclaimer);
          setSubheadingText(config?.createAccountSubtext || defaultSubheading);
        } else {
          // Normal SMS Gateway (e.g. SMSAPI / non-telco): Zero carrier billing mentions
          const defaultDisclaimer = 'By creating an account, you agree to our Terms & Conditions.';
          const defaultSubheading = 'Create your account to start practicing spoken English with Maya.';

          setDisclaimerText(config?.termsDisclaimer || defaultDisclaimer);
          setSubheadingText(config?.createAccountSubtext || defaultSubheading);
        }
      })
      .catch(() => {});
  }, []);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePhoneChange = (text: string) => {
    // Keep only digits
    let cleaned = text.replace(/[^0-9]/g, '');
    // Strip leading 0 or 94 if user typed/pasted it
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('94')) {
      cleaned = cleaned.slice(2);
    }
    // Cap at 9 digits
    if (cleaned.length > 9) {
      cleaned = cleaned.slice(0, 9);
    }

    setPhone(cleaned);
    if (errorMessage) setErrorMessage(null);
  };

  const validateEmail = (inputEmail: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(inputEmail);
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Validate First Name
    if (!cleanName) {
      setErrorMessage('Please enter your first name.');
      return;
    }

    // 2. Validate Sri Lankan Phone Number
    if (cleanPhone.length !== 9) {
      setErrorMessage('Please enter a valid 9-digit mobile number (e.g. 77 123 4567).');
      return;
    }
    if (!cleanPhone.startsWith('7')) {
      setErrorMessage('Sri Lankan mobile numbers must start with 7 (e.g. 77, 71, 76, 70).');
      return;
    }

    // 3. Validate Email Address
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    const fullPhone = `+94${cleanPhone}`;
    setIsLoading(true);
    playUnderstoodTapSound();

    try {
      // Save details to OnboardingStore
      OnboardingStore.updateField('name', cleanName);
      OnboardingStore.updateField('phone', fullPhone);
      OnboardingStore.updateField('email', cleanEmail);

      // Request OTP via telco / SMS gateway
      const res = await authService.sendOtp(fullPhone, { isLoginMode: false });

      if (res.alreadyRegistered) {
        const confirmed = await mayaAlert.confirm({
          title: 'Account Exists',
          message: 'An account with this phone number already exists. Would you like to log in instead?',
          confirmText: 'Log In',
          cancelText: 'Cancel',
        });
        if (confirmed) {
          router.push({
            pathname: '/onboarding/phone',
            params: { mode: 'login' },
          } as any);
        }
        return;
      }

      // If test account was auto-authenticated directly:
      if (res.isTestAccount && res.accessToken) {
        router.replace('/(tabs)/dashboard');
        return;
      }

      // Navigate to OTP verification screen
      router.push({
        pathname: '/onboarding/otp',
        params: {
          phone: fullPhone,
          name: cleanName,
          email: cleanEmail,
          mode: 'register',
        },
      } as any);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send verification code. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLogin = () => {
    router.push({
      pathname: '/onboarding/phone',
      params: { mode: 'login' },
    } as any);
  };

  const handleOpenTerms = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open('https://speakwithmaya.com/terms', '_blank');
    } else {
      Linking.openURL('https://speakwithmaya.com/terms').catch(() => {
        router.push('/terms' as any);
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.container, (isTablet || isDesktop) && styles.desktopContainer]}>
            {/* Top Progress Bar */}
            <View style={styles.progressContainer}>
              <ProgressBar progress={0.15} />
            </View>

            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Heading Section */}
              <View style={styles.header}>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>{subheadingText}</Text>
              </View>

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Form Inputs Group */}
              <View style={styles.formGroup}>
                {/* 1. First Name Field */}
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'name' && styles.inputContainerFocused,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Your first name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                {/* 2. Phone Number Row */}
                <View style={styles.phoneRow}>
                  {/* Left: Flag + Prefix Box */}
                  <View style={styles.prefixBox}>
                    <LKFlag width={22} height={15} />
                    <Text style={styles.prefixText}>+94</Text>
                  </View>

                  {/* Right: Phone Input Box */}
                  <View
                    style={[
                      styles.phoneInputContainer,
                      focusedField === 'phone' && styles.inputContainerFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.textInput}
                      placeholder="77 123 4567"
                      placeholderTextColor="#94A3B8"
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                      maxLength={9}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* 3. Email Field */}
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'email' && styles.inputContainerFocused,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                  />
                </View>
              </View>

              {/* Continue Button with MayaPrimaryButton */}
              <MayaPrimaryButton
                label="Continue"
                onPress={handleContinue}
                loading={isLoading}
                disabled={isLoading}
                showArrow={false}
                height={56}
                borderRadius={20}
                accessibilityLabel="Continue to account verification"
              />

              {/* Bottom Legal Disclaimer (Dynamic based on gateway) */}
              <View style={styles.legalSection}>
                <Text style={styles.legalText}>
                  {disclaimerText.includes('Terms & Conditions') ? (
                    <>
                      {disclaimerText.split('Terms & Conditions')[0]}
                      <Text style={styles.legalLink} onPress={handleOpenTerms}>
                        Terms & Conditions
                      </Text>
                      {disclaimerText.split('Terms & Conditions')[1]}
                    </>
                  ) : (
                    <>
                      {disclaimerText}{' '}
                      <Text style={styles.legalLink} onPress={handleOpenTerms}>
                        Terms & Conditions
                      </Text>
                    </>
                  )}
                </Text>
              </View>

              {/* Sign in Option for Existing Users */}
              <View style={styles.loginOptionContainer}>
                <Text style={styles.loginOptionText}>
                  Already have an account?{' '}
                  <Text style={styles.loginOptionLink} onPress={handleOpenLogin}>
                    Log in
                  </Text>
                </Text>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  desktopContainer: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  progressContainer: {
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 32,
    color: '#0F172A',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    color: '#64748B',
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  formGroup: {
    gap: 14,
    marginBottom: 24,
  },
  inputContainer: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  inputContainerFocused: {
    borderColor: '#2B5BFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(43, 91, 255, 0.12)',
      },
    }),
  },
  textInput: {
    ...fontStyle('inter', 'regular'),
    fontSize: 16,
    color: '#0F172A',
    padding: 0,
    margin: 0,
    width: '100%',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefixBox: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  prefixText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  phoneInputContainer: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  continueButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: '#2B5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2B5BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 14px rgba(43, 91, 255, 0.28)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#FFFFFF',
  },
  legalSection: {
    marginTop: 22,
    paddingHorizontal: 8,
  },
  legalText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: {
    color: '#2B5BFF',
    ...fontStyle('inter', 'medium'),
  },
  loginOptionContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginOptionText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
  },
  loginOptionLink: {
    color: '#2B5BFF',
    ...fontStyle('inter', 'semiBold'),
  },
});
