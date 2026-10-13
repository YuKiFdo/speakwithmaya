import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
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
  const useNative = Platform.OS !== 'web';

  // --- Entrance Animation Values ---
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const ticketAnim = useRef(new Animated.Value(0)).current;
  const discountPopAnim = useRef(new Animated.Value(0)).current;
  const urgencyAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // --- Continuous Idle Micro-Animation Values ---
  const ticketFloatAnim = useRef(new Animated.Value(0)).current;
  const clockWiggleAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Play celebratory chime upon opening the claim discount screen
    try {
      playAnalysisCompleteSound();
    } catch {}

    // 1. Staggered Entrance Sequence
    Animated.stagger(90, [
      // Top Pill Pop
      Animated.spring(badgeAnim, {
        toValue: 1,
        tension: 70,
        friction: 7,
        useNativeDriver: useNative,
      }),
      // Title & Subtitle Slide Up
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      // Ticket Card Spring Reveal + Inner 20% Pop
      Animated.parallel([
        Animated.spring(ticketAnim, {
          toValue: 1,
          tension: 55,
          friction: 7,
          useNativeDriver: useNative,
        }),
        Animated.sequence([
          Animated.delay(140),
          Animated.spring(discountPopAnim, {
            toValue: 1,
            tension: 90,
            friction: 5,
            useNativeDriver: useNative,
          }),
        ]),
      ]),
      // Urgency Card Slide Up
      Animated.spring(urgencyAnim, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: useNative,
      }),
      // CTA & Disclaimer Slide Up
      Animated.spring(ctaAnim, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: useNative,
      }),
    ]).start();

    // 2. Gentle Continuous Floating on Ticket Card
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ticketFloatAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(ticketFloatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );

    // 3. Subtle Urgency Clock Wiggle Loop
    const clockLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(clockWiggleAnim, {
          toValue: 1,
          duration: 90,
          useNativeDriver: useNative,
        }),
        Animated.timing(clockWiggleAnim, {
          toValue: -1,
          duration: 90,
          useNativeDriver: useNative,
        }),
        Animated.timing(clockWiggleAnim, {
          toValue: 1,
          duration: 90,
          useNativeDriver: useNative,
        }),
        Animated.timing(clockWiggleAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: useNative,
        }),
      ])
    );

    // 4. Subtle Breathing Pulse on Primary CTA Button
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, {
          toValue: 1.025,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(buttonPulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    floatLoop.start();
    clockLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      clockLoop.stop();
      pulseLoop.stop();
    };
  }, [
    badgeAnim,
    headerAnim,
    ticketAnim,
    discountPopAnim,
    urgencyAnim,
    ctaAnim,
    ticketFloatAnim,
    clockWiggleAnim,
    buttonPulseAnim,
    useNative,
  ]);

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

  // --- Interpolations ---
  const badgeStyle = {
    opacity: badgeAnim,
    transform: [
      {
        scale: badgeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
        }),
      },
      {
        translateY: badgeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
    ],
  };

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  const ticketStyle = {
    opacity: ticketAnim,
    transform: [
      {
        scale: ticketAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.82, 1],
        }),
      },
      {
        rotate: ticketAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-3deg', '0deg'],
        }),
      },
      {
        translateY: Animated.add(
          ticketAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [24, 0],
          }),
          ticketFloatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -5],
          })
        ),
      },
    ],
  };

  const discountNumberStyle = {
    opacity: discountPopAnim,
    transform: [
      {
        scale: discountPopAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1],
        }),
      },
    ],
  };

  const urgencyStyle = {
    opacity: urgencyAnim,
    transform: [
      {
        translateY: urgencyAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  const clockRotate = clockWiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  const ctaStyle = {
    opacity: ctaAnim,
    transform: [
      {
        translateY: ctaAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
    ],
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
          <Animated.View style={[styles.pillBadge, badgeStyle]}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.pillText}>Special One-Time Offer</Text>
          </Animated.View>

          {/* Heading & Subtitle */}
          <Animated.View style={[styles.headerWrapper, headerStyle]}>
            <Text style={styles.title}>Congratulations!</Text>
            <Text style={styles.subtitle}>
              You won a special discount for the 3{'\n'}Months Premium plan!
            </Text>
          </Animated.View>

          {/* Ticket Voucher Coupon Card */}
          <Animated.View
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
            style={[styles.ticketCard, ticketStyle]}
          >
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

              <Animated.View style={[styles.discountRow, discountNumberStyle]}>
                <Text style={styles.discountNumber}>20%</Text>
                <Text style={styles.discountUnit}>OFF</Text>
              </Animated.View>

              <Text style={styles.ticketSubtext}>
                Applied to 3 Months Premium Plan
              </Text>
            </View>
          </Animated.View>

          {/* Limited Time Urgency Card */}
          <Animated.View style={[styles.urgencyCard, urgencyStyle]}>
            <Animated.View
              style={[
                styles.urgencyIcon,
                { transform: [{ rotate: clockRotate }] },
              ]}
            >
              <Ionicons name="time-outline" size={28} color="#2563EB" />
            </Animated.View>
            <View style={styles.urgencyTextCol}>
              <Text style={styles.urgencyTitle}>Limited time offer</Text>
              <Text style={styles.urgencySubtitle}>
                Valid for this session only.
              </Text>
            </View>
          </Animated.View>

          {/* Primary CTA Claim Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              ctaStyle,
              { transform: [...ctaStyle.transform, { scale: buttonPulseAnim }] },
            ]}
          >
            <MayaPrimaryButton
              label="Claim 20% OFF"
              onPress={handleClaim}
              showArrow={true}
              height={56}
              borderRadius={28}
            />
          </Animated.View>

          {/* Bottom Security Disclaimer */}
          <Animated.View style={[styles.disclaimerRow, ctaStyle]}>
            <Feather
              name="lock"
              size={13}
              color="#64748B"
              style={styles.lockIcon}
            />
            <Text style={styles.disclaimerText}>
              Only one spin per user. Discount will be applied{'\n'}to the 3
              Months Premium plan.
            </Text>
          </Animated.View>
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
  headerWrapper: {
    alignItems: 'center',
    width: '100%',
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
        willChange: 'transform, opacity',
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