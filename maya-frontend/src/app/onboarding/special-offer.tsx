import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import Svg, {
  G,
  Path,
  Circle,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { MayaPrimaryButton } from '@/components/ui';
import {
  playStepPop,
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
const SLICE_ANGLE = 360 / SLICES.length; // 60 deg
const TARGET_DEG = 2400; // Lands cleanly on Slice 2 (20% OFF)

// Helper to convert polar to cartesian coordinates
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// Generate SVG arc path for a pie slice
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    x,
    y,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

// Precompute slice paths and text positions once at module load
// so zero math happens during React renders or animation frames
const PRECOMPUTED_SLICES = SLICES.map((slice, i) => {
  const startAngle = i * SLICE_ANGLE - SLICE_ANGLE / 2;
  const endAngle = startAngle + SLICE_ANGLE;
  const path = describeArc(CX, CY, RADIUS - 4, startAngle, endAngle);
  const midAngle = i * SLICE_ANGLE;
  const textPos = polarToCartesian(CX, CY, RADIUS * 0.65, midAngle);

  return {
    ...slice,
    path,
    midAngle,
    textPos,
  };
});

// Memoized Static Wheel Graphic so state updates never re-render the SVG
const WheelGraphic = React.memo(() => {
  const svgFontFamily =
    Platform.OS === 'web' ? 'Inter, sans-serif' : 'System';

  return (
    <>
      <Svg
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
      >
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
        {PRECOMPUTED_SLICES.map((slice) => (
          <G key={slice.id}>
            <Path
              d={slice.path}
              fill={slice.bgColor}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <SvgText
              x={slice.textPos.x}
              y={slice.textPos.y - 6}
              fill={slice.textColor}
              fontSize={16}
              fontWeight="800"
              fontFamily={svgFontFamily}
              textAnchor="middle"
              alignmentBaseline="central"
              transform={`rotate(${slice.midAngle}, ${slice.textPos.x}, ${slice.textPos.y})`}
            >
              {slice.label}
            </SvgText>
            <SvgText
              x={slice.textPos.x}
              y={slice.textPos.y + 12}
              fill={slice.textColor}
              fontSize={12}
              fontWeight="700"
              fontFamily={svgFontFamily}
              textAnchor="middle"
              alignmentBaseline="central"
              transform={`rotate(${slice.midAngle}, ${slice.textPos.x}, ${slice.textPos.y})`}
            >
              {slice.subLabel}
            </SvgText>
          </G>
        ))}

        {/* Center Hub */}
        <Circle cx={CX} cy={CY} r={36} fill="#E0F2FE" />
        <Circle
          cx={CX}
          cy={CY}
          r={30}
          fill="#2563EB"
          stroke="#FFFFFF"
          strokeWidth={3}
        />
      </Svg>

      {/* Center Gift Icon */}
      <View style={styles.centerGiftOverlay} pointerEvents="none">
        <Ionicons name="gift" size={24} color="#FFFFFF" />
      </View>
    </>
  );
});

export default function SpecialOfferScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();

  const [hasSpun, setHasSpun] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  // --- Staggered Entrance Animation Values ---
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const wheelEntranceAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;

  // --- Wheel Spin & Pointer Physics Values ---
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pointerBounceAnim = useRef(new Animated.Value(0)).current;
  const lastSliceIndexRef = useRef(0);
  const tickCounterRef = useRef(0);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useNative = Platform.OS !== 'web';

  // 1. Staggered Page Entrance Choreography on Mount
  useEffect(() => {
    Animated.stagger(95, [
      // Top Pill Pop
      Animated.spring(badgeAnim, {
        toValue: 1,
        tension: 75,
        friction: 7,
        useNativeDriver: useNative,
      }),
      // Title & Subtitle Glide Up
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      // Wheel Spring Scale + Subtle Intro Rotation
      Animated.spring(wheelEntranceAnim, {
        toValue: 1,
        tension: 55,
        friction: 7,
        useNativeDriver: useNative,
      }),
      // CTA Button & Disclaimer Glide Up
      Animated.spring(ctaAnim, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [badgeAnim, headerAnim, wheelEntranceAnim, ctaAnim, useNative]);

  // 2. Idle Breathing Pulse on "Tap to Spin" Button until spun
  useEffect(() => {
    if (isSpinning || hasSpun) {
      buttonPulseAnim.stopAnimation();
      buttonPulseAnim.setValue(1);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, {
          toValue: 1.025,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(buttonPulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [isSpinning, hasSpun, buttonPulseAnim, useNative]);

  // Spin rotation interpolation: 2400deg lands directly on Slice 2 (20% OFF)
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${TARGET_DEG}deg`],
  });

  // Subtle physical pointer flick when slice boundaries pass 12 o'clock
  const pointerRotateInterpolate = pointerBounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-18deg'],
  });

  const triggerPointerFlick = useCallback(() => {
    pointerBounceAnim.stopAnimation();
    pointerBounceAnim.setValue(1);
    Animated.spring(pointerBounceAnim, {
      toValue: 0,
      speed: 28,
      bounciness: 10,
      useNativeDriver: useNative,
    }).start();
  }, [pointerBounceAnim, useNative]);

  // Sync tick sounds & pointer flick to the actual angular velocity of the wheel
  useEffect(() => {
    const listenerId = spinAnim.addListener(({ value }) => {
      const currentDeg = value * TARGET_DEG;
      // Slice boundaries are offset by 30 deg (half a 60 deg slice)
      const boundaryCount = Math.floor(
        (currentDeg + SLICE_ANGLE / 2) / SLICE_ANGLE
      );

      if (boundaryCount > lastSliceIndexRef.current) {
        lastSliceIndexRef.current = boundaryCount;
        tickCounterRef.current += 1;

        try {
          playStepPop(tickCounterRef.current % 4);
        } catch {}

        triggerPointerFlick();
      }
    });

    return () => {
      spinAnim.removeListener(listenerId);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [spinAnim, triggerPointerFlick]);

  const handleSpin = () => {
    if (isSpinning || hasSpun) return;

    try {
      playOtherButtonSound();
    } catch {}

    setIsSpinning(true);
    lastSliceIndexRef.current = 0;
    tickCounterRef.current = 0;
    spinAnim.setValue(0);

    // Ultra-smooth quintic-style deceleration curve
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 6000,
      easing: Easing.bezier(0.12, 0.8, 0.2, 1.0),
      useNativeDriver: useNative,
    }).start(({ finished }) => {
      if (!finished) return;

      setIsSpinning(false);
      setHasSpun(true);

      // Play winning celebration fanfare
      try {
        playGoodJobSound();
      } catch {}

      // Automatically transition to the congratulations claim discount screen
      redirectTimeoutRef.current = setTimeout(() => {
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

  // --- Entrance Interpolations ---
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

  const wheelEntranceStyle = {
    opacity: wheelEntranceAnim,
    transform: [
      {
        scale: wheelEntranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1],
        }),
      },
      {
        rotate: wheelEntranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-18deg', '0deg'],
        }),
      },
      {
        translateY: wheelEntranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

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
          <Animated.View style={[styles.pillBadge, badgeStyle]}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.pillText}>Special One-Time Offer</Text>
          </Animated.View>

          {/* Heading & Subtitle */}
          <Animated.View style={[styles.headerGroup, headerStyle]}>
            <Text style={styles.titleLine1}>Spin & Get Your</Text>
            <Text style={styles.titleLine2}>Special Discount!</Text>

            <Text style={styles.subtitle}>
              Try your luck and claim your exclusive discount{'\n'}for the 3
              Months Premium plan.{'\n'}only one spin per user.
            </Text>
          </Animated.View>

          {/* Wheel Container */}
          <Animated.View style={[styles.wheelWrapper, wheelEntranceStyle]}>
            {/* Non-rotating Circular Base with Shadow */}
            <View style={styles.wheelShadowBase} />

            {/* Top Indicator Triangle Arrow */}
            <Animated.View
              style={[
                styles.pointerContainer,
                {
                  transform: [
                    { translateY: -6 },
                    { rotate: pointerRotateInterpolate },
                    { translateY: 6 },
                  ],
                },
              ]}
            >
              <Svg width={28} height={28} viewBox="0 0 28 28">
                <Polygon points="0,0 28,0 14,26" fill="#2563EB" />
              </Svg>
            </Animated.View>

            {/* Rotating Wheel Disk (Hardware Texture Cached for 60/120fps) */}
            <Animated.View
              renderToHardwareTextureAndroid={true}
              shouldRasterizeIOS={true}
              style={[
                styles.wheelDisk,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            >
              <WheelGraphic />
            </Animated.View>
          </Animated.View>

          {/* Tap to Spin CTA Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              ctaStyle,
              {
                transform: [
                  ...ctaStyle.transform,
                  { scale: buttonPulseAnim },
                ],
              },
            ]}
          >
            <MayaPrimaryButton
              label={
                isSpinning
                  ? 'Spinning...'
                  : hasSpun
                  ? 'Discount Claimed!'
                  : 'Tap to Spin'
              }
              onPress={handleSpin}
              disabled={isSpinning || hasSpun}
              loading={isSpinning}
              showArrow={false}
              height={56}
              borderRadius={28}
            />
          </Animated.View>

          {/* Disclaimer with Lock Icon */}
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
  headerGroup: {
    alignItems: 'center',
    width: '100%',
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
    ...Platform.select({
      web: {
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      } as any,
      default: {},
    }),
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