import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ScrollView,
  useWindowDimensions,
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
  playWheelTickSound,
  playTryAgainSound,
  playGoodJobSound,
  playOtherButtonSound,
} from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

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

const BASE_WHEEL_SIZE = 300;
const RADIUS = BASE_WHEEL_SIZE / 2;
const CX = RADIUS;
const CY = RADIUS;
const SLICE_ANGLE = 360 / SLICES.length; // 60 deg
// Clockwise rotation targets:
// - Slice 2 ("20% OFF", midAngle = 120 deg) lands at 12 o'clock when deg % 360 === 240
// - Slice 5 ("Try Again", midAngle = 300 deg) lands at 12 o'clock when deg % 360 === 60
const DIRECT_WIN_DEG = 1680; // 4 * 360 + 240 -> lands on 20% OFF
const TRY_AGAIN_DEG = 1500; // 4 * 360 + 60  -> lands on Try Again
const SECOND_SPIN_WIN_DEG = 3120; // 1500 + 1620 (8 * 360 + 240) -> lands on 20% OFF
const MAX_SPIN_DEG = 3120;

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
const WheelGraphic = React.memo(({ size }: { size: number }) => {
  const svgFontFamily =
    Platform.OS === 'web' ? 'Inter, sans-serif' : 'System';

  return (
    <>
      <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${BASE_WHEEL_SIZE} ${BASE_WHEEL_SIZE}`}
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
      <View style={styles.centerGiftOverlay}>
          <Ionicons name="gift" size={Math.round(size * 0.08)} color="#FFFFFF" />
      </View>
    </>
  );
});

export default function SpecialOfferScreen() {
  const params = useLocalSearchParams();
  const { isPhone } = useBreakpoint();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Responsive sizing so all content and the primary CTA fit comfortably even on smaller mobile screens
  const isCompactScreen = windowHeight < 740;
  const isVeryCompactScreen = windowHeight < 660;
  const wheelSize = Math.min(
    isPhone ? 256 : 284,
    Math.max(196, Math.round(Math.min(windowWidth - 56, windowHeight * 0.34)))
  );

  const [hasSpun, setHasSpun] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isTryAgainState, setIsTryAgainState] = useState(false);

  // Randomly pick one of the 2 spin flows on mount:
  // 1) 'direct-win': First spin lands directly on 20% OFF
  // 2) 'try-again-then-win': First spin lands on Try Again -> prompts user to spin again -> second spin lands on 20% OFF
  const spinScenarioRef = useRef<'direct-win' | 'try-again-then-win'>(
    Math.random() < 0.5 ? 'direct-win' : 'try-again-then-win'
  );
  const spinAttemptRef = useRef<number>(0);
  const activeStartDegRef = useRef<number>(0);
  const activeTargetDegRef = useRef<number>(DIRECT_WIN_DEG);

  // --- Staggered Entrance Animation Values ---
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const wheelEntranceAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;

  // --- Wheel Spin & Pointer Physics Values (spinAnim holds actual degrees rotated) ---
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pointerBounceAnim = useRef(new Animated.Value(0)).current;
  const lastSliceIndexRef = useRef(0);
  const lastFlickTimeRef = useRef(0);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useNative = Platform.OS !== 'web';

  // 1. Snappy Staggered Page Entrance Choreography on Mount
  useEffect(() => {
    authService.syncStep('/onboarding/special-offer');

    Animated.stagger(65, [
      // Top Pill Pop
      Animated.spring(badgeAnim, {
          toValue: 1,
          tension: 85,
          friction: 7,
          useNativeDriver: useNative,
      }),
      // Title & Subtitle Glide Up
      Animated.timing(headerAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
      }),
      // Wheel Spring Scale + Subtle Intro Rotation
      Animated.spring(wheelEntranceAnim, {
          toValue: 1,
          tension: 65,
          friction: 7,
          useNativeDriver: useNative,
      }),
      // CTA Button & Disclaimer Glide Up
      Animated.spring(ctaAnim, {
          toValue: 1,
          tension: 75,
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
            toValue: 1.022,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(buttonPulseAnim, {
            toValue: 1,
            duration: 1000,
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

  // Spin rotation interpolation: maps [0, MAX_SPIN_DEG] -> ['0deg', '3120deg']
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, MAX_SPIN_DEG],
    outputRange: ['0deg', `${MAX_SPIN_DEG}deg`],
  });

  // Subtle physical pointer flick when slice boundaries pass 12 o'clock
  const pointerRotateInterpolate = pointerBounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-15deg'],
  });

  const triggerPointerFlick = useCallback(() => {
    const now = Date.now();
    if (now - lastFlickTimeRef.current < 75) return;
    lastFlickTimeRef.current = now;

    pointerBounceAnim.stopAnimation();
    pointerBounceAnim.setValue(1);
    Animated.timing(pointerBounceAnim, {
      toValue: 0,
      duration: 95,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();
  }, [pointerBounceAnim, useNative]);

  // Sync crisp tick sounds & pointer flick to the angular velocity of the wheel
  useEffect(() => {
    const listenerId = spinAnim.addListener(({ value }) => {
      const currentDeg = value;
      // Slice boundaries are offset by 30 deg (half a 60 deg slice)
      const boundaryCount = Math.floor(
          (currentDeg + SLICE_ANGLE / 2) / SLICE_ANGLE
      );

      if (boundaryCount > lastSliceIndexRef.current) {
          lastSliceIndexRef.current = boundaryCount;
          const span = Math.max(1, activeTargetDegRef.current - activeStartDegRef.current);
          const progress = Math.min(1, Math.max(0, (currentDeg - activeStartDegRef.current) / span));
          playWheelTickSound(progress);
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

    const isFirstAttempt = spinAttemptRef.current === 0;
    spinAttemptRef.current += 1;

    const shouldLandOnTryAgain =
      isFirstAttempt && spinScenarioRef.current === 'try-again-then-win';

    const startDeg = isFirstAttempt ? 0 : TRY_AGAIN_DEG;
    const targetDeg = shouldLandOnTryAgain
      ? TRY_AGAIN_DEG
      : isFirstAttempt
      ? DIRECT_WIN_DEG
      : SECOND_SPIN_WIN_DEG;

    activeStartDegRef.current = startDeg;
    activeTargetDegRef.current = targetDeg;
    lastSliceIndexRef.current = Math.floor(
      (startDeg + SLICE_ANGLE / 2) / SLICE_ANGLE
    );

    setIsSpinning(true);
    setIsTryAgainState(false);
    spinAnim.setValue(startDeg);

    // Fast, silky-smooth deceleration curve
    Animated.timing(spinAnim, {
      toValue: targetDeg,
      duration: shouldLandOnTryAgain ? 2650 : 2950,
      easing: Easing.bezier(0.15, 0.85, 0.25, 1.0),
      useNativeDriver: useNative,
    }).start(({ finished }) => {
      if (!finished) return;

      setIsSpinning(false);

      if (shouldLandOnTryAgain) {
          // Landed on "Try Again" -> play playful bounce chime & invite user to spin again
          setIsTryAgainState(true);
          try {
            playTryAgainSound();
          } catch {}
          return;
      }

      setHasSpun(true);

      // Play winning celebration fanfare immediately on land
      try {
          playGoodJobSound();
      } catch {}

      // Snappy transition to the congratulations claim discount screen
      redirectTimeoutRef.current = setTimeout(() => {
          OnboardingStore.updateField('discountWon', '20-off');
          router.replace('/onboarding/claim-discount' as any);
      }, 450);
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
          <Animated.View
            style={[
              styles.pillBadge,
              isTryAgainState && styles.pillBadgeTryAgain,
              isCompactScreen && styles.pillBadgeCompact,
              badgeStyle,
            ]}
          >
            <Text style={styles.giftEmoji}>{isTryAgainState ? '🎯' : '🎁'}</Text>
            <Text
              style={[
                styles.pillText,
                isTryAgainState && styles.pillTextTryAgain,
              ]}
            >
              {isTryAgainState
                ? 'So Close! Free Bonus Spin Unlocked'
                : 'Special One-Time Offer'}
            </Text>
          </Animated.View>

          {/* Heading & Subtitle */}
          <Animated.View style={[styles.headerGroup, headerStyle]}>
            <Text
              style={[
                styles.titleLine1,
                isCompactScreen && styles.titleCompact,
                isVeryCompactScreen && styles.titleVeryCompact,
              ]}
            >
              {isTryAgainState ? 'Almost There!' : 'Spin & Get Your'}
            </Text>
            <Text
              style={[
                styles.titleLine2,
                isCompactScreen && styles.titleCompact,
                isVeryCompactScreen && styles.titleVeryCompact,
              ]}
            >
              {isTryAgainState ? 'Try Again Now!' : 'Special Discount!'}
            </Text>

            <Text
              style={[
                styles.subtitle,
                isCompactScreen && styles.subtitleCompact,
              ]}
            >
              {isTryAgainState
                ? 'You landed on Try Again! Tap the button below\nfor your bonus spin to claim your discount.'
                : 'Try your luck and claim your exclusive discount\nfor the 3 Months Premium plan.\nonly one spin per user.'}
            </Text>
          </Animated.View>

          {/* Wheel Container */}
          <Animated.View
            style={[
              styles.wheelWrapper,
              {
                width: wheelSize,
                height: wheelSize,
                marginBottom: isVeryCompactScreen ? 16 : isCompactScreen ? 22 : 28,
              },
              wheelEntranceStyle,
            ]}
          >
            {/* Non-rotating Circular Base with Shadow */}
            <View
              style={[
                styles.wheelShadowBase,
                {
                  width: wheelSize,
                  height: wheelSize,
                  borderRadius: wheelSize / 2,
                },
              ]}
            />

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
              <Svg width={24} height={24} viewBox="0 0 28 28">
                <Polygon points="0,0 28,0 14,26" fill="#2563EB" />
              </Svg>
            </Animated.View>

            {/* Rotating Wheel Disk (Hardware Texture Cached for 60/120fps) */}
            <Animated.View
              renderToHardwareTextureAndroid={true}
              shouldRasterizeIOS={true}
              style={[
                styles.wheelDisk,
                {
                  width: wheelSize,
                  height: wheelSize,
                  borderRadius: wheelSize / 2,
                  transform: [{ rotate: spinInterpolate }],
                },
              ]}
            >
              <WheelGraphic size={wheelSize} />
            </Animated.View>
          </Animated.View>

          {/* Tap to Spin CTA Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              isCompactScreen && styles.buttonWrapperCompact,
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
                  : isTryAgainState
                  ? 'Try Again'
                  : 'Tap to Spin'
              }
              onPress={handleSpin}
              disabled={isSpinning || hasSpun}
              loading={isSpinning}
              showArrow={false}
              height={isVeryCompactScreen ? 50 : 54}
              borderRadius={27}
            />
          </Animated.View>

          {/* Disclaimer with Lock Icon */}
          <Animated.View style={[styles.disclaimerRow, ctaStyle]}>
            <Feather
              name="lock"
              size={12}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scrollContentDesktop: {
    paddingVertical: 36,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
    gap: 6,
  },
  pillBadgeTryAgain: {
    backgroundColor: '#EFF6FF',
  },
  pillBadgeCompact: {
    marginBottom: 10,
    paddingVertical: 5,
  },
  giftEmoji: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 12.5,
    color: '#E11D48',
    letterSpacing: -0.2,
    ...fontStyle('inter', 'bold'),
  },
  pillTextTryAgain: {
    color: '#2563EB',
  },
  headerGroup: {
    alignItems: 'center',
    width: '100%',
  },
  titleLine1: {
    fontSize: 27,
    lineHeight: 33,
    color: '#10213D',
    letterSpacing: -0.6,
    textAlign: 'center',
    ...fontStyle('inter', 'extraBold'),
  },
  titleLine2: {
    fontSize: 27,
    lineHeight: 33,
    color: '#2563EB',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 8,
    ...fontStyle('inter', 'extraBold'),
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  titleVeryCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19.5,
    marginBottom: 20,
    ...fontStyle('inter', 'regular'),
  },
  subtitleCompact: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wheelShadowBase: {
    position: 'absolute',
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
    top: -10,
    zIndex: 10,
    alignItems: 'center',
  },
  wheelDisk: {
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
    pointerEvents: 'none',
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  buttonWrapperCompact: {
    marginBottom: 10,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  lockIcon: {
    marginTop: -6,
  },
  disclaimerText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16.5,
    ...fontStyle('inter', 'regular'),
  },
});