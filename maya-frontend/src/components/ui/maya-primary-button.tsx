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
  { id: 1, left: '12%', top: '65%', size: 4, delay: '0s', duration: '2.5s' },
  { id: 2, left: '26%', top: '75%', size: 3, delay: '0.6s', duration: '2.8s' },
  { id: 3, left: '42%', top: '55%', size: 4.5, delay: '1.2s', duration: '2.3s' },
  { id: 4, left: '58%', top: '70%', size: 3.5, delay: '0.3s', duration: '2.7s' },
  { id: 5, left: '74%', top: '60%', size: 4, delay: '1.7s', duration: '2.4s' },
  { id: 6, left: '86%', top: '72%', size: 3, delay: '0.9s', duration: '2.9s' },
];

function GlowingParticle({ p }: { p: (typeof GLOW_PARTICLES)[0] }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delayMs = parseFloat(p.delay) * 1000;
    const durationMs = parseFloat(p.duration) * 1000;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: durationMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    }, delayMs);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, -6, -16, -24],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0.6, 1.2, 0.9, 0.3],
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
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

const BUTTON_ANIMATION_CSS = `
@keyframes mayaButtonGlowPulse {
  0%, 100% {
    box-shadow: 0 6px 20px rgba(0, 107, 229, 0.35);
  }
  50% {
    box-shadow: 0 8px 26px rgba(0, 107, 229, 0.48);
  }
}
@keyframes mayaShimmerSweep {
  0% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
  15% { opacity: 0.55; }
  40% { transform: translateX(250%) skewX(-20deg); opacity: 0; }
  100% { transform: translateX(250%) skewX(-20deg); opacity: 0; }
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
  const handlePress = () => {
    if (disabled || loading) return;
    if (playSound) {
      playUnderstoodTapSound();
    }
    onPress?.();
  };

  return (
    <View style={styles.outerContainer}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{ __html: BUTTON_ANIMATION_CSS }} />
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        style={({ pressed }) => [
          styles.primaryButton,
          { height, borderRadius },
          pressed && !disabled && styles.primaryButtonPressed,
          disabled && styles.primaryButtonDisabled,
          style,
        ]}
      >
        {/* Shimmer sweep ray */}
        {Platform.OS === 'web' && !disabled && (
          <View pointerEvents="none" style={styles.shimmerRay} />
        )}

        {/* Glowing floating particles */}
        {!disabled && GLOW_PARTICLES.map((p) => (
          <GlowingParticle key={p.id} p={p} />
        ))}

        {/* Button Content Row */}
        <View style={styles.buttonContentRow} pointerEvents="none">
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <View style={{ marginRight: 8 }}>{icon}</View>
              )}
              <Text style={[styles.primaryButtonText, textStyle]}>
                {label}
              </Text>
              {icon && iconPosition === 'right' && (
                <View style={{ marginLeft: 8 }}>{icon}</View>
              )}
              {showArrow && (
                <Feather
                  name="arrow-right"
                  size={20}
                  color="#ffffff"
                  style={styles.buttonArrow}
                />
              )}
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
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
        backgroundImage: 'linear-gradient(180deg, #087FF5 0%, #006BE5 100%)',
        boxShadow: '0 6px 20px rgba(0, 107, 229, 0.35)',
        animationKeyframes: 'mayaButtonGlowPulse',
        animationDuration: '3s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.1s ease',
      } as any,
      default: {
        shadowColor: '#006BE5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.42,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
        boxShadow: 'none',
        animationKeyframes: 'none',
      } as any,
      default: {
        elevation: 0,
        shadowOpacity: 0,
      },
    }),
  },
  shimmerRay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 50%, transparent 100%)',
        animationKeyframes: 'mayaShimmerSweep',
        animationDuration: '3.5s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      } as any,
    }),
  },
  glowParticle: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  primaryButtonText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 17.5,
    letterSpacing: -0.2,
  },
  buttonArrow: {
    marginLeft: 8,
  },
});
