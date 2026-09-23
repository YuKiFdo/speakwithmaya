import React from 'react';
import { StyleSheet, Animated } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
}

export function AmbientGlow({ type, opacity }: AmbientGlowProps) {
  if (type === 'purple-bottom') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.purpleBottom, { opacity }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            {/* Full-width vertical gradient to spread edge-to-edge across the bottom */}
            <LinearGradient id="purpleBottomLinear" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#d946ef" stopOpacity="0.65" />
              <Stop offset="18%" stopColor="#c026d3" stopOpacity="0.45" />
              <Stop offset="45%" stopColor="#a855f7" stopOpacity="0.22" />
              <Stop offset="72%" stopColor="#c084fc" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
            {/* Subtle center warm glow */}
            <RadialGradient
              id="purpleBottomRadial"
              cx="50%"
              cy="100%"
              r="75%"
              fx="50%"
              fy="100%"
            >
              <Stop offset="0%" stopColor="#c026d3" stopOpacity="0.30" />
              <Stop offset="40%" stopColor="#d946ef" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#purpleBottomLinear)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#purpleBottomRadial)" />
        </Svg>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.blueAura, { opacity }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {/* Gentle, wide-radius ambient sky-blue vignette for Maya speaking */}
          <RadialGradient
            id="blueAuraGrad"
            cx="50%"
            cy="50%"
            r="75%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="65%" stopColor="#bae6fd" stopOpacity="0.25" />
            <Stop offset="85%" stopColor="#38bdf8" stopOpacity="0.40" />
            <Stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.48" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#blueAuraGrad)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  purpleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 380,
    zIndex: 1,
    overflow: 'hidden',
  },
  blueAura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});
