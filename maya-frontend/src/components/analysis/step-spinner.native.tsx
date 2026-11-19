import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const SIZE = 54;
const R = 25;
const ARC = `${2 * Math.PI * R * 0.3} ${2 * Math.PI * R}`;

/** Spinning progress arc around the analysis step that is currently running (native). */
export function StepSpinner() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, { transform: [{ rotate }] }]}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#E0F2FE" strokeWidth={2.5} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#0284C7"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={ARC}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE, zIndex: 2 },
});
