import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { LKFlag } from '@/components/icons/lk-flag';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors, Radii } from '@/theme/tokens';

export default function PhoneScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const [phone, setPhone] = useState('');
  const { isDesktop, isTablet } = useBreakpoint();

  const handleSendCode = () => {
    const formattedPhone = phone.trim() ? `+94 ${phone.trim()}` : '+94 77 123 4567';
    router.push({
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
        <View style={styles.container}>
          {/* Top Progress Bar */}
          <View style={styles.progressContainer}>
            <ProgressBar progress={0.25} />
          </View>

          {/* Main Content */}
          <View style={styles.body}>
            {/* Plan Info Card */}
            <View style={styles.planCard}>
              <Text style={styles.cardHeader}>
                To continue, enter your phone number and enable your{' '}
                <Text style={styles.starterPlanHighlight}>Starter Plan</Text>
              </Text>
              <Text style={styles.cardTitle}>
                Enter your mobile number
              </Text>
              <Text style={styles.cardPricingNotice}>
                Get started for just LKR 8 + tax/day.{'\n'}Cancel anytime.
              </Text>
            </View>

            {/* Phone Input Row */}
            <View style={styles.inputRow}>
              {/* Country Code Box */}
              <View style={styles.countryBox}>
                <LKFlag width={26} height={17} />
                <Text style={styles.countryCode}>+94</Text>
              </View>

              {/* Number Input */}
              <View style={styles.numberInputWrapper}>
                <TextInput
                  style={styles.numberInput}
                  placeholder="77 123 4567"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                />
              </View>
            </View>
          </View>

          {/* Bottom Button */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={handleSendCode}
              accessibilityRole="button"
              accessibilityLabel="Send Verification Code"
            >
              <Text style={styles.ctaButtonText}>Send Verification Code</Text>
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
    gap: 20,
    paddingTop: 120,
  },
  planCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 24,
  },
  starterPlanHighlight: {
    color: Colors.brand.primary,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  cardPricingNotice: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    height: 56,
    paddingHorizontal: 16,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  numberInputWrapper: {
    flex: 1,
  },
  numberInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#0f172a',
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
