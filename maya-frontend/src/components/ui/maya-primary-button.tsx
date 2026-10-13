import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Easing,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { playUnderstoodTapSound } from '@/services/sound/sound-service';

export const GLOW_PARTICLES = [
  { id: 1, left: '12%', top: '68%', size: 4, delay: '0s', duration: '2.5s', driftX: 4 },
  { id: 2, left: '26%', top: '76%', size: 3, delay: '0.6s', duration: '2.8s', driftX: -5 },
  { id: 3, left: '42%', top: '58%', size: 4.5, delay: '1.2s', duration: '2.3s', driftX: 5 },
  { id: 4, left: '58%', top: '72%', size: 3.5, delay: '0.3s', duration: '2.7s', driftX: -4 },
  { id: 5, left: '74%', top: '62%', size: 4, delay: '1.7s', duration: '2.4s', driftX: 4 },
  { id: 6, left: '86%', top: '74%', size: 3, delay: '0.9s', duration: '2.9s', driftX: -3 },
];

const GlowingParticle = React.memo(function GlowingParticle({
  p,
}: {
  p: (typeof GLOW_PARTICLES)[0];
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    const delayMs = parseFloat(p.delay) * 1000;
    const durationMs = parseFloat(p.duration) * 1000;

    const particleLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(anim, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: useNative,
        }),
      ])
    );

    particleLoop.start();
    return () => particleLoop.stop();
  }, [anim, p.delay, p.duration, useNative]);

  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, -6, -16, -24],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, p.driftX, p.driftX * 0.5],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0.5, 1.25, 0.95, 0.3],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, 0.95, 0.75, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glowParticle,
        {
          left: p.left as any,
          top: p.top as any,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
});

const BUTTON_ANIMATION_CSS = `
@keyframes mayaButtonGlowPulse {
  0%, 100% {
    box-shadow: 0 8px 22px rgba(0, 107, 229, 0.38);
  }
  50% {
    box-shadow: 0 10px 28px rgba(0, 107, 229, 0.52);
  }
}
`;

export interface MayaPrimaryButtonProps {
  label: string;
  onPress?: () => void;
  showArrow?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  playSound?: boolean;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function MayaPrimaryButton({
  label,
  onPress,
  showArrow = true,
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  playSound = true,
  height = 58,
  borderRadius = 22,
  style,
  textStyle,
  accessibilityLabel,
}: MayaPrimaryButtonProps) {
  const useNative = Platform.OS !== 'web';

  // Tactile spring press animations
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressTranslateY = useRef(new Animated.Value(0)).current;

  // Cross-platform Shimmer & Arrow Nudge loop
  const loopAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled || loading) {
      loopAnim.stopAnimation();
      loopAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(loopAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: useNative,
        }),
        Animated.timing(loopAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: useNative,
        }),
        Animated.delay(1200),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [disabled, loading, loopAnim, useNative]);

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.968,
        tension: 220,
        friction: 10,
        useNativeDriver: useNative,
      }),
      Animated.spring(pressTranslateY, {
        toValue: 2,
        tension: 220,
        friction: 10,
        useNativeDriver: useNative,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        tension: 160,
        friction: 7,
        useNativeDriver: useNative,
      }),
      Animated.spring(pressTranslateY, {
        toValue: 0,
        tension: 160,
        friction: 7,
        useNativeDriver: useNative,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (playSound) {
      try {
        playUnderstoodTapSound();
      } catch {}
    }
    onPress?.();
  };

  // Shimmer sweeps across the button width on both Mobile & Web
  const shimmerTranslateX = loopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 380],
  });

  const shimmerOpacity = loopAnim.interpolate({
    inputRange: [0, 0.15, 0.5, 0.85, 1],
    outputRange: [0, 0.9, 1, 0.9, 0],
  });

  // Subtle forward nudge on the right arrow as the shimmer passes
  const arrowTranslateX = loopAnim.interpolate({
    inputRange: [0, 0.35, 0.65, 1],
    outputRange: [0, 0, 4.5, 0],
  });

  return (
    <Animated.View
      style={[
        styles.shadowContainer,
        { borderRadius },
        disabled && styles.shadowDisabled,
        {
          transform: [
            { scale: pressScale },
            { translateY: pressTranslateY },
          ],
        },
        style,
      ]}
    >
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{ __html: BUTTON_ANIMATION_CSS }} />
      )}

      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        style={[
          styles.primaryButton,
          { height, borderRadius },
          disabled && styles.primaryButtonDisabled,
        ]}
      >
        {/* Top 3D Specular Rim Highlight */}
        {!disabled && (
          <View
            pointerEvents="none"
            style={[
              styles.topRimHighlight,
              {
                borderTopLeftRadius: borderRadius,
                borderTopRightRadius: borderRadius,
              },
            ]}
          />
        )}

        {/* Bottom Subtle Depth Lip */}
        {!disabled && (
          <View
            pointerEvents="none"
            style={[
              styles.bottomLipShade,
              {
                borderBottomLeftRadius: borderRadius,
                borderBottomRightRadius: borderRadius,
              },
            ]}
          />
        )}

        {/* Cross-Platform Diagonal Light Sheen Sweep */}
        {!disabled && !loading && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmerBand,
              {
                opacity: shimmerOpacity,
                transform: [
                  { translateX: shimmerTranslateX },
                  { rotate: '22deg' },
                ],
              },
            ]}
          >
            <View style={styles.shimmerEdge} />
            <View style={styles.shimmerCore} />
            <View style={styles.shimmerEdge} />
          </Animated.View>
        )}

        {/* Glowing floating particles */}
        {!disabled &&
          GLOW_PARTICLES.map((p) => <GlowingParticle key={p.id} p={p} />)}

        {/* Button Content Row */}
        <View style={styles.buttonContentRow} pointerEvents="none">
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <View style={styles.iconLeft}>{icon}</View>
              )}

              <Text style={[styles.primaryButtonText, textStyle]}>{label}</Text>

              {icon && iconPosition === 'right' && (
                <View style={styles.iconRight}>{icon}</View>
              )}

              {showArrow && (
                <Animated.View
                  style={[
                    styles.arrowWrapper,
                    { transform: [{ translateX: arrowTranslateX }] },
                  ]}
                >
                  <Feather name="arrow-right" size={20} color="#ffffff" />
                </Animated.View>
              )}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Outer wrapper holds the shadow (no overflow: 'hidden' so iOS renders the full glow!)
  shadowContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 22px rgba(0, 107, 229, 0.38)',
        animationKeyframes: 'mayaButtonGlowPulse',
        animationDuration: '3s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      } as any,
      default: {
        shadowColor: '#006BE5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  shadowDisabled: {
    ...Platform.select({
      web: {
        boxShadow: 'none',
        animationKeyframes: 'none',
      } as any,
      default: {
        shadowOpacity: 0,
        elevation: 0,
      },
    }),
  },
  primaryButton: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#006BE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(180deg, #1E88FF 0%, #006BE5 55%, #0058C4 100%)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
      default: {},
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.5,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
      default: {},
    }),
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '44%',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    zIndex: 1,
  },
  bottomLipShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 35, 95, 0.22)',
    zIndex: 1,
  },
  shimmerBand: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 68,
    flexDirection: 'row',
    zIndex: 2,
  },
  shimmerEdge: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  shimmerCore: {
    width: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  glowParticle: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px rgba(255, 255, 255, 0.85)',
      } as any,
      default: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 3,
      },
    }),
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 3,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  primaryButtonText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 17.5,
    letterSpacing: -0.2,
  },
  arrowWrapper: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});