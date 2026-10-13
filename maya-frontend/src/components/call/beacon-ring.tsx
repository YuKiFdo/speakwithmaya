import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Platform, Easing } from 'react-native';

interface GlowingHaloProps {
  color?: string;
  radius?: number;
  active?: boolean;
}

/**
 * Continuous breathing outer-only glow animation that hugs rounded buttons.
 * Has ZERO color/fill inside the button (purely transparent interior) and radiates
 * vibrant colored glow strictly OUTWARD via box-shadow and outer halo.
 */
export function BeaconRing({
  color = '#7afcff',
  radius = 999,
  active = true,
}: GlowingHaloProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      pulseAnim.setValue(0);
    };
  }, [active]);

  if (!active) return null;

  // Subtle breathing scale (1.0 -> 1.05)
  const animatedScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.05],
  });

  // Breathing opacity (0.7 -> 1.0)
  const animatedOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.outerGlowRing,
        {
          borderColor: color,
          borderRadius: radius,
          opacity: animatedOpacity,
          transform: [{ scale: animatedScale }],
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: `0 0 16px 3px ${color}, 0 0 6px 1px ${color}`,
              } as any)
            : {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 14,
                elevation: 6,
              }),
        },
      ]}
    />
  );
}

// Export alias
export const RoundedGlowingHalo = BeaconRing;

const styles = StyleSheet.create({
  outerGlowRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    zIndex: 10,
  },
});
