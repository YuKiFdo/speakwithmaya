import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, {
  G,
  Path,
  Circle,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { MayaPrimaryButton } from '@/components/ui';
import {
  playStepPop,
  playAnalysisCompleteSound,
  playGoodJobSound,
  playOtherButtonSound,
} from '@/services/sound/sound-service';

// Wheel configuration: 6 slices (60 degrees each)
// Angles measured from -90 deg (12 o'clock)
const SLICES = [
  {
    id: '50-off',
    label: '50%',
    subLabel: 'OFF',
    bgColor: '#FFFFFF',
    textColor: '#10213D',
    isWinner: true,
  },
  {
    id: '30-off',
    label: '30%',
    subLabel: 'OFF',
    bgColor: '#1D4ED8',
    textColor: '#FFFFFF',
  },
  {
    id: '20-off',
    label: '20%',
    subLabel: 'OFF',
    bgColor: '#0EA5E9',
    textColor: '#FFFFFF',
  },
  {
    id: '10-off',
    label: '10%',
    subLabel: 'OFF',
    bgColor: '#FFFFFF',
    textColor: '#10213D',
  },
  {
    id: '5-off',
    label: '5%',
    subLabel: 'OFF',
    bgColor: '#1E40AF',
    textColor: '#FFFFFF',
  },
  {
    id: 'try-again',
    label: 'Try',
    subLabel: 'Again',
    bgColor: '#38BDF8',
    textColor: '#FFFFFF',
  },
];

const WHEEL_SIZE = 300;
const RADIUS = WHEEL_SIZE / 2;
const CX = RADIUS;
const CY = RADIUS;

// Helper to convert polar to cartesian coordinates
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// Generate SVG arc path for a pie slice
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

export default function SpecialOfferScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();

  const [hasSpun, setHasSpun] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spin rotation interpolation: 2400deg lands directly on Slice 2 (20% OFF)
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2400deg'], // Always lands cleanly on 20% OFF!
  });

  const handleSpin = () => {
    if (isSpinning || hasSpun) return;

    try {
      playOtherButtonSound();
    } catch {}

    setIsSpinning(true);

    // Tick sounds during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      try {
        playStepPop(tickCount % 4);
      } catch {}
      if (tickCount > 18) clearInterval(tickInterval);
    }, 180);

    // Realistic physics deceleration spin
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 4000,
      easing: Easing.bezier(0.15, 0.85, 0.25, 1.0),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      setHasSpun(true);

      // Play winning celebration fanfare
      try {
        playGoodJobSound();
      } catch {}

      // Automatically transition to the congratulations claim discount screen
      setTimeout(() => {
        router.replace({
          pathname: '/onboarding/claim-discount' as any,
          params: {
            ...params,
            discountWon: '20-off',
          },
        });
      }, 750);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isPhone && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.container}>
          {/* Top Pill: Special One-Time Offer */}
          <View style={styles.pillBadge}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.pillText}>Special One-Time Offer</Text>
          </View>

          {/* Heading */}
          <Text style={styles.titleLine1}>Spin & Get Your</Text>
          <Text style={styles.titleLine2}>Special Discount!</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Try your luck and claim your exclusive discount{'\n'}for the 3 Months Premium plan.{'\n'}only one spin per user.
          </Text>

          {/* Wheel Container */}
          <View style={styles.wheelWrapper}>
            {/* Non-rotating Circular Base with Shadow */}
            <View style={styles.wheelShadowBase} />

            {/* Top Indicator Triangle Arrow */}
            <View style={styles.pointerContainer}>
              <Svg width={28} height={28} viewBox="0 0 28 28">
                <Polygon points="0,0 28,0 14,26" fill="#2563EB" />
              </Svg>
            </View>

            {/* Rotating Wheel Disk */}
            <Animated.View
              style={[
                styles.wheelDisk,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            >
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                {/* Outer Ring Circle */}
                <Circle
                  cx={CX}
                  cy={CY}
                  r={RADIUS - 2}
                  fill="#FFFFFF"
                  stroke="#E2E8F0"
                  strokeWidth={4}
                />

                {/* Slices */}
                {SLICES.map((slice, i) => {
                  const anglePerSlice = 360 / SLICES.length;
                  const startAngle = i * anglePerSlice - anglePerSlice / 2;
                  const endAngle = startAngle + anglePerSlice;
                  const path = describeArc(CX, CY, RADIUS - 4, startAngle, endAngle);

                  // Position for slice text
                  const midAngle = i * anglePerSlice;
                  const textPos = polarToCartesian(CX, CY, RADIUS * 0.65, midAngle);

                  return (
                    <G key={slice.id}>
                      <Path
                        d={path}
                        fill={slice.bgColor}
                        stroke="#E2E8F0"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={textPos.x}
                        y={textPos.y - 6}
                        fill={slice.textColor}
                        fontSize={16}
                        fontWeight="800"
                        fontFamily={Platform.OS === 'web' ? 'Inter, sans-serif' : 'System'}
                        textAnchor="middle"
                        alignmentBaseline="central"
                        transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}
                      >
                        {slice.label}
                      </SvgText>
                      <SvgText
                        x={textPos.x}
                        y={textPos.y + 12}
                        fill={slice.textColor}
                        fontSize={12}
                        fontWeight="700"
                        fontFamily={Platform.OS === 'web' ? 'Inter, sans-serif' : 'System'}
                        textAnchor="middle"
                        alignmentBaseline="central"
                        transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}
                      >
                        {slice.subLabel}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Center Hub */}
                <Circle cx={CX} cy={CY} r={36} fill="#E0F2FE" />
                <Circle cx={CX} cy={CY} r={30} fill="#2563EB" stroke="#FFFFFF" strokeWidth={3} />
              </Svg>

              {/* Center Gift Icon */}
              <View style={styles.centerGiftOverlay}>
                <Ionicons name="gift" size={24} color="#FFFFFF" />
              </View>
            </Animated.View>
          </View>

          {/* Tap to Spin CTA Button */}
          <View style={styles.buttonWrapper}>
            <MayaPrimaryButton
              label={isSpinning ? 'Spinning...' : hasSpun ? 'Discount Claimed!' : 'Tap to Spin'}
              onPress={handleSpin}
              disabled={isSpinning || hasSpun}
              loading={isSpinning}
              showArrow={false}
              height={56}
              borderRadius={28}
            />
          </View>

          {/* Disclaimer with Lock Icon */}
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
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 20,
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
  titleLine1: {
    fontSize: 30,
    color: '#10213D',
    letterSpacing: -0.7,
    textAlign: 'center',
    ...fontStyle('inter', 'extraBold'),
  },
  titleLine2: {
    fontSize: 30,
    color: '#2563EB',
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 12,
    ...fontStyle('inter', 'extraBold'),
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    ...fontStyle('inter', 'regular'),
  },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    position: 'relative',
  },
  wheelShadowBase: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 32px rgba(37, 99, 235, 0.12)',
      } as any,
      default: {
        elevation: 6,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
    }),
  },
  pointerContainer: {
    position: 'absolute',
    top: -12,
    zIndex: 10,
    alignItems: 'center',
  },
  wheelDisk: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGiftOverlay: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: 20,
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
