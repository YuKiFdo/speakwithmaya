import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { MayaPrimaryButton, ConfettiOverlay } from '@/components/ui';
import {
  playAnalysisCompleteSound,
  playOtherButtonSound,
} from '@/services/sound/sound-service';

export default function ClaimDiscountScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();

  useEffect(() => {
    // Play celebratory chime upon opening the claim discount screen
    try {
      playAnalysisCompleteSound();
    } catch {}
  }, []);

  const handleClaim = () => {
    try {
      playOtherButtonSound();
    } catch {}
    router.replace({
      pathname: '/onboarding/personalized-plan' as any,
      params: {
        ...params,
        discountWon: '20-off',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Celebratory Confetti Animation */}
      <ConfettiOverlay />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isPhone && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.container}>
          {/* Top Pill Badge */}
          <View style={styles.pillBadge}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.pillText}>Special One-Time Offer</Text>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Congratulations!</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            You won a special discount for the 3{'\n'}Months Premium plan!
          </Text>

          {/* Ticket Voucher Coupon Card */}
          <View style={styles.ticketCard}>
            {/* Left Circular Notch Cutout */}
            <View style={styles.leftNotch} />

            {/* Right Circular Notch Cutout */}
            <View style={styles.rightNotch} />

            {/* Left Vertical Dashed Line */}
            <View style={styles.leftDashedLine} />

            {/* Right Vertical Dashed Line */}
            <View style={styles.rightDashedLine} />

            {/* Card Content */}
            <View style={styles.ticketInner}>
              <Text style={styles.ticketCategory}>SPECIAL DISCOUNT</Text>

              <View style={styles.discountRow}>
                <Text style={styles.discountNumber}>20%</Text>
                <Text style={styles.discountUnit}>OFF</Text>
              </View>

              <Text style={styles.ticketSubtext}>
                Applied to 3 Months Premium Plan
              </Text>
            </View>
          </View>

          {/* Limited Time Urgency Card */}
          <View style={styles.urgencyCard}>
            <Ionicons name="time-outline" size={28} color="#2563EB" style={styles.urgencyIcon} />
            <View style={styles.urgencyTextCol}>
              <Text style={styles.urgencyTitle}>Limited time offer</Text>
              <Text style={styles.urgencySubtitle}>Valid for this session only.</Text>
            </View>
          </View>

          {/* Primary CTA Claim Button */}
          <View style={styles.buttonWrapper}>
            <MayaPrimaryButton
              label="Claim 20% OFF"
              onPress={handleClaim}
              showArrow={true}
              height={56}
              borderRadius={28}
            />
          </View>

          {/* Bottom Security Disclaimer */}
          <View style={styles.disclaimerRow}>
            <Feather name="lock" size={13} color="#64748B" style={styles.lockIcon} />
            <Text style={styles.disclaimerText}>
              Only one spin per user. Discount will be applied{'\n'}to the 3 Months Premium plan.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  scrollContentDesktop: {
    paddingVertical: 56,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
    gap: 6,
  },
  giftEmoji: {
    fontSize: 15,
  },
  pillText: {
    fontSize: 13,
    color: '#E11D48',
    letterSpacing: -0.2,
    ...fontStyle('inter', 'bold'),
  },
  title: {
    fontSize: 32,
    color: '#10213D',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 8,
    ...fontStyle('inter', 'extraBold'),
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    ...fontStyle('inter', 'regular'),
  },
  ticketCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 36px rgba(37, 99, 235, 0.08)',
      } as any,
      default: {
        elevation: 3,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
    }),
  },
  leftNotch: {
    position: 'absolute',
    left: -14,
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 2,
  },
  rightNotch: {
    position: 'absolute',
    right: -14,
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 2,
  },
  leftDashedLine: {
    position: 'absolute',
    left: 40,
    top: 14,
    bottom: 14,
    width: 1,
    borderLeftWidth: 1.5,
    borderLeftColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  rightDashedLine: {
    position: 'absolute',
    right: 40,
    top: 14,
    bottom: 14,
    width: 1,
    borderLeftWidth: 1.5,
    borderLeftColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  ticketInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ticketCategory: {
    fontSize: 13,
    color: '#10213D',
    letterSpacing: 1.4,
    marginBottom: 8,
    ...fontStyle('inter', 'extraBold'),
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 6,
  },
  discountNumber: {
    fontSize: 58,
    lineHeight: 64,
    color: '#2563EB',
    letterSpacing: -2,
    ...fontStyle('inter', 'extraBold'),
  },
  discountUnit: {
    fontSize: 24,
    color: '#2563EB',
    letterSpacing: -0.5,
    marginLeft: 6,
    marginTop: 24,
    ...fontStyle('inter', 'extraBold'),
  },
  ticketSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    ...fontStyle('inter', 'medium'),
  },
  urgencyCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#F0F7FF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 28,
    gap: 12,
  },
  urgencyIcon: {
    marginRight: 2,
  },
  urgencyTextCol: {
    flex: 1,
  },
  urgencyTitle: {
    fontSize: 14,
    color: '#10213D',
    letterSpacing: -0.2,
    marginBottom: 2,
    ...fontStyle('inter', 'bold'),
  },
  urgencySubtitle: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  lockIcon: {
    marginTop: -8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    ...fontStyle('inter', 'regular'),
  },
});
